"""
Text Embedding Service for ResearchMind AI.
Supports Google Gemini API (0 MB disk space) and local SentenceTransformers.
"""

import logging
import os
import asyncio
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseEmbedder(ABC):
    """Abstract base class for text embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the vector dimension produced by this embedder."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return human-readable model identifier."""
        pass

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of text strings into vector representations."""
        pass

    async def embed_query(self, query: str) -> list[float]:
        """Embed a single query text."""
        results = await self.embed_texts([query])
        return results[0]


# ---------------------------------------------------------------------------
# SentenceTransformers implementation (local CPU execution)
# ---------------------------------------------------------------------------

class SentenceTransformerEmbedder(BaseEmbedder):
    """
    Local embedding using sentence-transformers (all-MiniLM-L6-v2).
    Dimension: 384. CPU friendly (~90 MB RAM, fast inference).
    """

    DEFAULT_MODEL = "all-MiniLM-L6-v2"
    BATCH_SIZE = 32

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self._model_name = model_name
        self._model = None
        self._dimension: int = 384

    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info("Loading SentenceTransformer model: %s", self._model_name)
                self._model = SentenceTransformer(self._model_name)
                self._dimension = self._model.get_sentence_embedding_dimension()
            except ImportError:
                raise RuntimeError(
                    "sentence-transformers is not installed. "
                    "Run `pip install sentence-transformers` to use local embeddings."
                )

    @property
    def dimension(self) -> int:
        self._load_model()
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        self._load_model()
        loop = asyncio.get_event_loop()

        def _encode():
            embeddings = self._model.encode(
                texts,
                batch_size=self.BATCH_SIZE,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return embeddings.tolist()

        embeddings = await loop.run_in_executor(None, _encode)
        return embeddings


# ---------------------------------------------------------------------------
# Gemini API implementation (0 MB local disk usage)
# ---------------------------------------------------------------------------

class GeminiEmbedder(BaseEmbedder):
    """
    Uses Google's gemini-embedding-001 model via API key.
    Requires 0 MB local disk space.
    """

    MODEL = "models/gemini-embedding-001"
    BATCH_SIZE = 100

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        if not self._api_key:
            logger.warning("GEMINI_API_KEY not set — GeminiEmbedder will fail at runtime.")

    @property
    def dimension(self) -> int:
        return 768

    @property
    def model_name(self) -> str:
        return self.MODEL

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        try:
            import google.generativeai as genai
        except ImportError:
            raise RuntimeError("google-generativeai package not installed.")

        genai.configure(api_key=self._api_key)
        all_embeddings: list[list[float]] = []

        loop = asyncio.get_event_loop()
        
        def _embed_batch(batch: list[str]):
            result = genai.embed_content(
                model=self.MODEL, 
                content=batch,
                output_dimensionality=self.dimension
            )
            return result['embedding']

        for i in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[i: i + self.BATCH_SIZE]
            embeddings = await loop.run_in_executor(None, _embed_batch, batch)
            all_embeddings.extend(embeddings)

        return all_embeddings


# ---------------------------------------------------------------------------
# Factory — controlled by environment variable
# ---------------------------------------------------------------------------

def get_embedder() -> BaseEmbedder:
    """
    Factory function for selecting an embedder based on EMBEDDING_PROVIDER env var.
    Default: gemini (Google API, 0 MB disk storage)
    Options: gemini | sentence-transformers
    """
    provider = os.getenv("EMBEDDING_PROVIDER", "gemini").lower()

    if provider in ("sentence-transformers", "local", "st"):
        model_name = os.getenv("EMBEDDING_MODEL", SentenceTransformerEmbedder.DEFAULT_MODEL)
        logger.info("Using SentenceTransformers embedder: %s", model_name)
        return SentenceTransformerEmbedder(model_name=model_name)
    else:
        logger.info("Using Gemini embedder (Zero disk space usage)")
        return GeminiEmbedder()
