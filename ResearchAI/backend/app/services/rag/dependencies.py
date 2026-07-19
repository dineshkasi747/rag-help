"""
RAG dependency provider — singleton instances shared across requests.

Uses module-level singletons (not FastAPI app state) because:
- Embedders and rerankers are expensive to initialize (model loading)
- They are stateless after init — safe to share across async requests
- FastAPI's lifespan events are the cleanest way to init/teardown
"""

from __future__ import annotations
import logging
from functools import lru_cache

from app.services.rag.chunker import SemanticChunker
from app.services.rag.embedder import get_embedder, BaseEmbedder
from app.services.rag.reranker import CrossEncoderReranker
from app.services.rag.vector_store import VectorStoreService
from app.services.rag.llm_provider import get_llm, BaseLLM
from app.services.rag.pipeline import RAGPipeline

logger = logging.getLogger(__name__)

# Module-level singletons
_embedder: BaseEmbedder | None = None
_vector_store: VectorStoreService | None = None
_reranker: CrossEncoderReranker | None = None
_llm: BaseLLM | None = None
_pipeline: RAGPipeline | None = None
_chunker: SemanticChunker | None = None


def init_rag() -> None:
    """Called once at application startup."""
    global _embedder, _vector_store, _reranker, _llm, _pipeline, _chunker

    _embedder = get_embedder()
    _vector_store = VectorStoreService(dimension=_embedder.dimension)
    _reranker = CrossEncoderReranker()
    _llm = get_llm()
    _pipeline = RAGPipeline(_embedder, _vector_store, _reranker, _llm)
    _chunker = SemanticChunker()

    logger.info(
        "RAG initialized: embedder=%s llm=%s",
        _embedder.model_name, type(_llm).__name__,
    )


def get_pipeline() -> RAGPipeline:
    if _pipeline is None:
        raise RuntimeError("RAG pipeline not initialized. Call init_rag() first.")
    return _pipeline


def get_chunker() -> SemanticChunker:
    if _chunker is None:
        raise RuntimeError("Chunker not initialized. Call init_rag() first.")
    return _chunker
