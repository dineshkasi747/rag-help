"""
RAG Pipeline — orchestrates the full retrieval-augmented generation flow.

Pipeline stages:
1. Query → Embed (bi-encoder)
2. Vector search with metadata filter → top-20 candidates
3. Cross-encoder reranking → top-5
4. Context compression (remove redundant sentences)
5. Prompt construction with grounded citations
6. LLM generation (streaming)

Explanation modes: eli5, undergrad, grad, phd, interview, math, code
Citation format: [Section Name, p.N] traceable to a specific chunk
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

logger = logging.getLogger(__name__)

EXPLANATION_MODES = {
    "eli5": "Explain using very simple language a 12-year-old would understand. Use analogies.",
    "undergrad": "Explain for an undergraduate CS/ML student. Assume calculus and basic ML knowledge.",
    "grad": "Explain for a graduate student. Include technical details and intuition.",
    "phd": "Provide a rigorous, technically precise explanation. Include limitations and nuances.",
    "interview": "Explain concisely as if answering a technical interview question. Lead with the key insight.",
    "math": "Provide a mathematical explanation with equations, derivations, and formal notation.",
    "code": "Explain via pseudocode or Python code. Prioritize implementation clarity.",
}

SYSTEM_PROMPT_TEMPLATE = """You are ResearchMind AI — an expert academic tutor specializing in research papers.

EXPLANATION MODE: {mode_description}

STRICT RULES:
1. Answer ONLY from the provided context passages. Never fabricate information.
2. Do NOT include any inline citations, bracketed numbers (like [1], [2], [10]), section names, or page numbers in your response text. Keep the explanation text completely clean and natural.
3. If the context does not contain sufficient information to answer, say: "The paper does not appear to address this directly. Based on context: ..."
4. Structure your answer with clear paragraphs.
5. End with a brief "Key Takeaway" section.

RETRIEVED CONTEXT:
{context}
"""


@dataclass
class Citation:
    text: str
    section_type: str
    page_number: Optional[int]
    chunk_id: str
    relevance_score: float


@dataclass
class RAGResponse:
    answer: str
    citations: list[Citation]
    explanation_mode: str
    chunks_retrieved: int
    chunks_after_rerank: int


class RAGPipeline:
    """
    Stateless pipeline — instantiate once, call methods per request.
    Dependencies injected via constructor (testable with mocks).
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

    # ------------------------------------------------------------------
    # Indexing (called after paper processing)
    # ------------------------------------------------------------------

    async def index_chunks(self, chunks: list[TextChunk]) -> None:
        """Embed and store chunks in Qdrant."""
        if not chunks:
            return
        await self._vs.ensure_collection()
        texts = [c.text for c in chunks]
        embeddings = await self._embedder.embed_texts(texts)
        await self._vs.upsert_chunks(chunks, embeddings)
        logger.info("Indexed %d chunks", len(chunks))

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    async def retrieve(
        self,
        query: str,
        paper_ids: Optional[list[int]] = None,
        section_types: Optional[list[str]] = None,
        top_k: int = 20,
        top_n_rerank: int = 10,
    ) -> list[RankedResult]:
        """Embed query → search → rerank → return top_n grounded candidates."""
        query_vec = await self._embedder.embed_query(query)

        raw_results = await self._vs.search(
            query_vector=query_vec,
            top_k=top_k,
            paper_ids=paper_ids,
            section_types=section_types,
        )

        candidates: list[RankedResult] = [
            RankedResult(
                text=r.payload["text"],
                score=r.score,
                paper_id=r.payload["paper_id"],
                section_type=r.payload["section_type"],
                section_id=r.payload["section_id"],
                page_number=r.payload.get("page_number"),
                chunk_id=r.payload["chunk_id"],
            )
            for r in raw_results
        ]

        reranked = await self._reranker.rerank(query, candidates, top_n=top_n_rerank)
        logger.info("Retrieved %d → reranked to %d", len(candidates), len(reranked))
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
                text=r["text"][:200] + "...",
                section_type=r["section_type"],
                page_number=r["page_number"],
                chunk_id=r["chunk_id"],
                relevance_score=r["score"],
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
    # Streaming generation
    # ------------------------------------------------------------------

    async def stream_answer(
        self,
        query: str,
        paper_ids: Optional[list[int]] = None,
        mode: str = "grad",
        conversation_history: Optional[list[dict]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Yields SSE-formatted strings:
        - data: {"type": "context", ...}   — sent first with citations
        - data: {"type": "delta", "text": "..."}  — streamed tokens
        - data: {"type": "done"}  — signals completion
        """
        reranked = await self.retrieve(query, paper_ids=paper_ids)

        # Emit context metadata first
        citations_payload = [
            {
                "section_type": r["section_type"],
                "page_number": r["page_number"],
                "score": round(r["score"], 3),
                "preview": r["text"][:150],
            }
            for r in reranked
        ]
        yield f"data: {json.dumps({'type': 'context', 'citations': citations_payload})}\n\n"

        context = self._build_context(reranked)
        messages = self._build_messages(query, context, mode, conversation_history)

        async for delta in self._llm.stream(messages):
            yield f"data: {json.dumps({'type': 'delta', 'text': delta})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_context(self, results: list[RankedResult]) -> str:
        parts = []
        for i, r in enumerate(results, start=1):
            page = f"p.{r['page_number']}" if r["page_number"] else "p.?"
            parts.append(
                f"[{i}] [{r['section_type'].replace('_', ' ').title()}, {page}]\n{r['text']}"
            )
        return "\n\n---\n\n".join(parts)

    def _build_messages(
        self,
        query: str,
        context: str,
        mode: str,
        history: Optional[list[dict]],
    ) -> list[dict]:
        mode_desc = EXPLANATION_MODES.get(mode, EXPLANATION_MODES["grad"])
        system = SYSTEM_PROMPT_TEMPLATE.format(
            mode_description=mode_desc,
            context=context,
        )
        messages: list[dict] = [{"role": "system", "content": system}]

        if history:
            messages.extend(history[-6:])  # Keep last 3 turns for context

        messages.append({"role": "user", "content": query})
        return messages
