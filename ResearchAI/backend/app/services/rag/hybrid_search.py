"""
Hybrid Search Engine for Professional RAG.

Combines:
1. Dense Semantic Vector Search (Cosine similarity over 768-dim embeddings via Qdrant)
2. Sparse Lexical Search (BM25 token ranking with TF-IDF weighting)
3. Reciprocal Rank Fusion (RRF) algorithm to produce calibrated hybrid scores:
   RRF_Score(d) = (w_dense / (k + rank_dense(d))) + (w_sparse / (k + rank_sparse(d)))
4. Multi-Query Expansion / HyDE support for complex research queries.
"""

from __future__ import annotations
import math
import re
import logging
from collections import Counter
from typing import Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Standard RRF constant (typically 60 in academic literature)
RRF_K = 60
DEFAULT_DENSE_WEIGHT = 0.65
DEFAULT_SPARSE_WEIGHT = 0.35


@dataclass
class HybridSearchResult:
    text: str
    paper_id: int
    section_id: int
    section_type: str
    page_number: Optional[int]
    chunk_id: str
    dense_score: float
    sparse_score: float
    rrf_score: float
    dense_rank: Optional[int] = None
    sparse_rank: Optional[int] = None
    metadata: dict = field(default_factory=dict)


class BM25Index:
    """
    In-memory BM25 index for paper text chunks.
    Fast, zero-dependency implementation optimized for research domain queries.
    """

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus_size: int = 0
        self.avgdl: float = 0.0
        self.doc_lengths: list[int] = []
        self.doc_freqs: list[Counter] = []
        self.idf: dict[str, float] = {}
        self.chunk_map: list[dict] = []

    def _tokenize(self, text: str) -> list[str]:
        # Lowercase and match alphanumeric tokens + math/hyphenated terms
        tokens = re.findall(r"\b[a-zA-Z0-9_\-\./]+\b", text.lower())
        return [t for t in tokens if len(t) > 1 and not t.isdigit()]

    def fit(self, chunks: list[dict]) -> None:
        """Fit BM25 on a list of chunk dicts (must contain 'text' and chunk metadata)."""
        self.corpus_size = len(chunks)
        if self.corpus_size == 0:
            return

        self.chunk_map = chunks
        self.doc_lengths = []
        self.doc_freqs = []
        df: Counter = Counter()

        for chunk in chunks:
            tokens = self._tokenize(chunk.get("text", ""))
            self.doc_lengths.append(len(tokens))
            term_freq = Counter(tokens)
            self.doc_freqs.append(term_freq)
            for term in term_freq:
                df[term] += 1

        self.avgdl = sum(self.doc_lengths) / max(1, self.corpus_size)

        # Calculate IDF with smoothing
        self.idf = {}
        for term, freq in df.items():
            # Standard Lucene/BM25 IDF formula
            self.idf[term] = math.log(1.0 + (self.corpus_size - freq + 0.5) / (freq + 0.5))

    def search(self, query: str, top_k: int = 20) -> list[tuple[int, float]]:
        """Search BM25 index. Returns list of (chunk_index, bm25_score) sorted descending."""
        if not self.corpus_size or not query:
            return []

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        scores: list[float] = [0.0] * self.corpus_size

        for term in q_tokens:
            if term not in self.idf:
                continue
            idf_val = self.idf[term]

            for i in range(self.corpus_size):
                tf = self.doc_freqs[i].get(term, 0)
                if tf == 0:
                    continue
                doc_len = self.doc_lengths[i]
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / max(1.0, self.avgdl)))
                scores[i] += idf_val * (numerator / max(1e-5, denominator))

        # Rank documents with positive score
        scored_docs = [(i, score) for i, score in enumerate(scores) if score > 0.0]
        scored_docs.sort(key=lambda x: x[1], reverse=True)
        return scored_docs[:top_k]


class HybridSearchEngine:
    """
    Combines Qdrant dense vector search with in-memory BM25 sparse search and RRF.
    """

    def __init__(
        self,
        dense_weight: float = DEFAULT_DENSE_WEIGHT,
        sparse_weight: float = DEFAULT_SPARSE_WEIGHT,
        rrf_k: int = RRF_K,
    ):
        self.dense_weight = dense_weight
        self.sparse_weight = sparse_weight
        self.rrf_k = rrf_k

    def reciprocal_rank_fusion(
        self,
        dense_candidates: list[dict],
        sparse_candidates: list[dict],
        top_n: int = 15,
    ) -> list[HybridSearchResult]:
        """
        Merge ranked dense and sparse lists using Reciprocal Rank Fusion.
        """
        rrf_scores: dict[str, float] = {}
        dense_ranks: dict[str, int] = {}
        sparse_ranks: dict[str, int] = {}
        dense_score_map: dict[str, float] = {}
        sparse_score_map: dict[str, float] = {}
        item_data: dict[str, dict] = {}

        # 1. Process dense rankings
        for rank, item in enumerate(dense_candidates, start=1):
            cid = item["chunk_id"]
            dense_ranks[cid] = rank
            dense_score_map[cid] = item.get("score", 0.0)
            item_data[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (self.dense_weight / (self.rrf_k + rank))

        # 2. Process sparse rankings
        for rank, item in enumerate(sparse_candidates, start=1):
            cid = item["chunk_id"]
            sparse_ranks[cid] = rank
            sparse_score_map[cid] = item.get("score", 0.0)
            if cid not in item_data:
                item_data[cid] = item
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (self.sparse_weight / (self.rrf_k + rank))

        # 3. Sort by combined RRF score
        sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        results: list[HybridSearchResult] = []
        for cid in sorted_ids[:top_n]:
            data = item_data[cid]
            results.append(
                HybridSearchResult(
                    text=data["text"],
                    paper_id=data["paper_id"],
                    section_id=data["section_id"],
                    section_type=data["section_type"],
                    page_number=data.get("page_number"),
                    chunk_id=cid,
                    dense_score=dense_score_map.get(cid, 0.0),
                    sparse_score=sparse_score_map.get(cid, 0.0),
                    rrf_score=rrf_scores[cid],
                    dense_rank=dense_ranks.get(cid),
                    sparse_rank=sparse_ranks.get(cid),
                    metadata=data.get("metadata", {}),
                )
            )

        logger.debug(
            "RRF fused %d dense + %d sparse items into %d hybrid candidates",
            len(dense_candidates), len(sparse_candidates), len(results)
        )
        return results
