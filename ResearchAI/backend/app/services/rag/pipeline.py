"""
RAG Pipeline — orchestrates the full professional retrieval-augmented generation flow.

Pipeline stages:
1. Query → Embed (bi-encoder 768-dim) + BM25 Lexical Tokenization
2. Hybrid Retrieval (Dense Vector Search + BM25 Sparse Search)
3. Reciprocal Rank Fusion (RRF) candidate merging
4. Cross-Encoder Re-ranking → top-N grounded passages
5. Context synthesis with clean paragraph structure
6. Grounded citations with section anchors, page numbers, and relevance scores
7. LLM generation (SSE streaming or complete)
"""

from __future__ import annotations
import json
import logging
from dataclasses import dataclass, field
from typing import AsyncGenerator, Optional

from app.services.rag.chunker import TextChunk
from app.services.rag.embedder import BaseEmbedder
from app.services.rag.reranker import CrossEncoderReranker, RankedResult
from app.services.rag.vector_store import VectorStoreService
from app.services.rag.llm_provider import BaseLLM
from app.services.rag.hybrid_search import HybridSearchEngine, BM25Index

logger = logging.getLogger(__name__)

EXPLANATION_MODES = {
    "eli5": "Explain using very simple language a 12-year-old would understand. Use intuitive analogies.",
    "undergrad": "Explain for an undergraduate CS/ML student. Assume calculus and basic ML knowledge.",
    "grad": "Explain for a graduate student or AI engineer. Include architectural details and technical intuition.",
    "phd": "Provide a rigorous, technically precise mathematical and theoretical explanation. Discuss limitations.",
    "interview": "Explain concisely as if answering a senior AI/ML interview question. Lead with the key innovation.",
    "math": "Provide a mathematical breakdown with formulas, loss functions, and derivations.",
    "code": "Explain with structured pseudocode and Python examples highlighting implementation nuances.",
}

SYSTEM_PROMPT_TEMPLATE = """You are ResearchMind AI — an expert academic tutor and research scientist.

EXPLANATION MODE: {mode_description}

STRICT RULES:
1. Answer accurately from the provided retrieved context passages.
2. Structure your answer with clear, elegant markdown formatting (headers, bold terms, bullet points where helpful).
3. Do NOT include ugly bracketed numbers (like [1], [2]) directly in the sentence flow — keep prose natural and readable.
4. If the context does not contain sufficient information to answer, state what is known from the context, and clarify what is missing.
5. End with a dedicated "### Key Takeaways" section summarizing 2-3 core insights.

RETRIEVED RESEARCH CONTEXT:
{context}
"""


@dataclass
class Citation:
    text: str
    section_type: str
    page_number: Optional[int]
    chunk_id: str
    relevance_score: float
    confidence_pct: float = 0.0


@dataclass
class RAGResponse:
    answer: str
    citations: list[Citation]
    explanation_mode: str
    chunks_retrieved: int
    chunks_after_rerank: int


class RAGPipeline:
    """
    State-of-the-art hybrid RAG pipeline with dense + BM25 retrieval, RRF, and cross-encoder re-ranking.
    """

    def __init__(
        self,
        embedder: BaseEmbedder,
        vector_store: VectorStoreService,
        reranker: CrossEncoderReranker,
        llm: BaseLLM,
    ):
        self._embedder = embedder
        self._vs = vector_store
        self._reranker = reranker
        self._llm = llm
        self._hybrid = HybridSearchEngine()
        self._bm25 = BM25Index()
        self._all_chunks_cache: list[dict] = []

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    async def index_chunks(self, chunks: list[TextChunk]) -> None:
        """Embed and store chunks in Qdrant and update BM25 index."""
        if not chunks:
            return
        await self._vs.ensure_collection()
        texts = [c.text for c in chunks]
        embeddings = await self._embedder.embed_texts(texts)
        await self._vs.upsert_chunks(chunks, embeddings)

        # Update in-memory BM25 index
        for c in chunks:
            self._all_chunks_cache.append({
                "chunk_id": c.id,
                "text": c.text,
                "paper_id": c.paper_id,
                "section_id": c.section_id,
                "section_type": c.section_type,
                "page_number": c.page_number,
                "metadata": c.metadata,
            })
        self._bm25.fit(self._all_chunks_cache)
        logger.info("Indexed %d chunks into Hybrid Vector + BM25 Store", len(chunks))

    # ------------------------------------------------------------------
    # Retrieval (Hybrid Search: Dense + BM25 + RRF + Cross-Encoder)
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        paper_ids: Optional[list[int]] = None,
        section_types: Optional[list[str]] = None,
        top_k: int = 20,
        top_n_rerank: int = 8,
    ) -> list[RankedResult]:
        """Hybrid retrieve: Dense Vector + BM25 + RRF -> Cross-Encoder Rerank."""
        query_vec = await self._embedder.embed_query(query)

        # 1. Dense Search via Qdrant
        raw_dense = await self._vs.search(
            query_vector=query_vec,
            top_k=top_k,
            paper_ids=paper_ids,
            section_types=section_types,
        )

        dense_candidates = [
            {
                "chunk_id": r.payload["chunk_id"],
                "text": r.payload["text"],
                "score": float(r.score),
                "paper_id": r.payload["paper_id"],
                "section_type": r.payload["section_type"],
                "section_id": r.payload["section_id"],
                "page_number": r.payload.get("page_number"),
                "metadata": r.payload,
            }
            for r in raw_dense
        ]

        # 2. Sparse Search via BM25
        sparse_candidates = []
        if self._bm25.corpus_size > 0:
            bm25_matches = self._bm25.search(query, top_k=top_k)
            for idx, b_score in bm25_matches:
                ch = self._all_chunks_cache[idx]
                if paper_ids and ch["paper_id"] not in paper_ids:
                    continue
                if section_types and ch["section_type"] not in section_types:
                    continue
                sparse_candidates.append({
                    "chunk_id": ch["chunk_id"],
                    "text": ch["text"],
                    "score": float(b_score),
                    "paper_id": ch["paper_id"],
                    "section_type": ch["section_type"],
                    "section_id": ch["section_id"],
                    "page_number": ch.get("page_number"),
                    "metadata": ch.get("metadata", {}),
                })

        # 3. Reciprocal Rank Fusion (RRF)
        if sparse_candidates:
            hybrid_fused = self._hybrid.reciprocal_rank_fusion(
                dense_candidates, sparse_candidates, top_n=top_k
            )
            candidates_for_rerank: list[RankedResult] = [
                RankedResult(
                    text=h.text,
                    score=h.rrf_score,
                    paper_id=h.paper_id,
                    section_type=h.section_type,
                    section_id=h.section_id,
                    page_number=h.page_number,
                    chunk_id=h.chunk_id,
                )
                for h in hybrid_fused
            ]
        else:
            candidates_for_rerank = [
                RankedResult(
                    text=d["text"],
                    score=d["score"],
                    paper_id=d["paper_id"],
                    section_type=d["section_type"],
                    section_id=d["section_id"],
                    page_number=d["page_number"],
                    chunk_id=d["chunk_id"],
                )
                for d in dense_candidates
            ]

        # 4. Cross-Encoder Re-ranking
        reranked = await self._reranker.rerank(query, candidates_for_rerank, top_n=top_n_rerank)
        logger.info(
            "Hybrid Retrieve: %d dense + %d sparse -> %d candidates -> %d reranked",
            len(dense_candidates), len(sparse_candidates), len(candidates_for_rerank), len(reranked)
        )
        return reranked

    # ------------------------------------------------------------------
    # Generation (non-streaming)
    # ------------------------------------------------------------------

    async def answer(
        self,
        query: str,
        paper_ids: Optional[list[int]] = None,
        mode: str = "grad",
        conversation_history: Optional[list[dict]] = None,
    ) -> RAGResponse:
        reranked = await self.retrieve(query, paper_ids=paper_ids)

        context = self._build_context(reranked)
        messages = self._build_messages(query, context, mode, conversation_history)

        answer_text = await self._llm.complete(messages)

        citations = [
            Citation(
                text=r["text"][:220] + "...",
                section_type=r["section_type"],
                page_number=r["page_number"],
                chunk_id=r["chunk_id"],
                relevance_score=round(r["score"], 4),
                confidence_pct=round(min(100.0, max(10.0, (r["score"] + 1.0) * 50.0 if r["score"] < 1 else r["score"] * 100)), 1),
            )
            for r in reranked
        ]

        return RAGResponse(
            answer=answer_text,
            citations=citations,
            explanation_mode=mode,
            chunks_retrieved=len(reranked),
            chunks_after_rerank=len(reranked),
        )

    # ------------------------------------------------------------------
    # Streaming Generation
    # ------------------------------------------------------------------

    async def stream_answer(
        self,
        query: str,
        paper_ids: Optional[list[int]] = None,
        mode: str = "grad",
        conversation_history: Optional[list[dict]] = None,
    ) -> AsyncGenerator[str, None]:
        reranked = await self.retrieve(query, paper_ids=paper_ids)

        # Emit context event with citation anchors
        citations_data = [
            {
                "text": r["text"][:220] + "...",
                "section_type": r["section_type"],
                "page_number": r["page_number"],
                "chunk_id": r["chunk_id"],
                "score": round(r["score"], 4),
                "confidence_pct": round(min(100.0, max(10.0, (r["score"] + 1.0) * 50.0 if r["score"] < 1 else r["score"] * 100)), 1),
            }
            for r in reranked
        ]
        yield f"data: {json.dumps({'type': 'context', 'citations': citations_data})}\n\n"

        context = self._build_context(reranked)
        messages = self._build_messages(query, context, mode, conversation_history)

        async for token in self._llm.stream(messages):
            yield f"data: {json.dumps({'type': 'delta', 'text': token})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    # ------------------------------------------------------------------
    # Prompt Construction
    # ------------------------------------------------------------------

    def _build_context(self, results: list[RankedResult]) -> str:
        if not results:
            return "No relevant context found in the uploaded documents."

        passages = []
        for i, r in enumerate(results, 1):
            page_info = f" | Page {r['page_number']}" if r["page_number"] else ""
            header = f"--- [Passage {i}: Section: {r['section_type'].upper()}{page_info}] ---"
            passages.append(f"{header}\n{r['text']}")
        return "\n\n".join(passages)

    def _build_messages(
        self,
        query: str,
        context: str,
        mode: str,
        conversation_history: Optional[list[dict]],
    ) -> list[dict]:
        mode_desc = EXPLANATION_MODES.get(mode, EXPLANATION_MODES["grad"])
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            mode_description=mode_desc,
            context=context,
        )

        messages = [{"role": "system", "content": system_prompt}]

        if conversation_history:
            for turn in conversation_history[-6:]:
                messages.append({"role": turn["role"], "content": turn["content"]})

        messages.append({"role": "user", "content": query})
        return messages
