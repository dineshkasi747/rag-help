"""
Cross-encoder reranker for RAG retrieved results.

Design rationale:
- Two-stage retrieval: bi-encoder (ANN search) retrieves top-K candidates fast.
  Cross-encoder then re-scores the top-K by jointly encoding (query, passage),
  which is much more accurate but too slow for full-corpus search.
- This approach (used in MS-MARCO, ColBERT, etc.) consistently outperforms
  single-stage dense retrieval on precision metrics.
- Model: cross-encoder/ms-marco-MiniLM-L-6-v2 — strong accuracy, 80MB, fast on CPU.
- Lazy loading: model is loaded on first call, not at import time.
"""

from __future__ import annotations
import asyncio
import logging
import os
from typing import TypedDict

logger = logging.getLogger(__name__)


class RankedResult(TypedDict):
    text: str
    score: float
    paper_id: int
    section_type: str
    section_id: int
    page_number: int | None
    chunk_id: str


class CrossEncoderReranker:
    """
    Wraps a HuggingFace cross-encoder for result reranking.
    Falls back to original order if model unavailable.
    """

    DEFAULT_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(self, model_name: str | None = None):
        self._model_name = model_name or os.getenv("RERANKER_MODEL", self.DEFAULT_MODEL)
        self._model = None

    def _load(self):
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
                self._model = CrossEncoder(self._model_name)
                logger.info("Loaded CrossEncoder: %s", self._model_name)
            except ImportError:
                logger.warning("sentence-transformers not installed — reranking disabled.")
            except Exception as e:
                logger.warning("Failed to load CrossEncoder: %s — reranking disabled.", e)
        return self._model

    async def rerank(
        self,
        query: str,
        candidates: list[RankedResult],
        top_n: int = 5,
    ) -> list[RankedResult]:
        """
        Rerank candidates by (query, passage) cross-encoder score.
        Returns top_n results sorted by descending score.
        """
        if not candidates:
            return []

        model = self._load()
        if model is None:
            # Graceful degradation: return top_n by original vector score
            return candidates[:top_n]

        pairs = [(query, c["text"]) for c in candidates]

        loop = asyncio.get_event_loop()
        scores: list[float] = await loop.run_in_executor(
            None, lambda: model.predict(pairs).tolist()
        )

        ranked = sorted(
            zip(candidates, scores),
            key=lambda x: x[1],
            reverse=True,
        )

        results = []
        for candidate, score in ranked[:top_n]:
            results.append({**candidate, "score": score})

        logger.debug(
            "Reranked %d→%d candidates; top score=%.3f",
            len(candidates), len(results), results[0]["score"] if results else 0,
        )
        return results
