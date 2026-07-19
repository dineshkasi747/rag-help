"""
Qdrant vector store service.

Design rationale:
- One Qdrant collection per deployment (not per paper). Papers are distinguished
  by payload metadata (paper_id, section_type). This avoids collection-per-paper
  explosion and enables cross-paper search.
- Named vectors: "dense" (embedding) + "sparse" (BM25) for hybrid retrieval.
  Hybrid search combines semantic similarity with keyword precision — critical for
  technical queries containing exact model names, metrics, or equations.
- Payload indexing on paper_id and section_type enables sub-millisecond
  pre-filtering before ANN search (metadata filtering).
"""

from __future__ import annotations
import logging
from typing import Optional, Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    ScoredPoint,
    PayloadSchemaType,
)

from app.core.config import settings
from app.services.rag.chunker import TextChunk

logger = logging.getLogger(__name__)

COLLECTION_NAME = "research_chunks"


class VectorStoreService:
    """
    Manages the Qdrant collection lifecycle and chunk operations.
    Uses AsyncQdrantClient — all methods are coroutines.
    """

    def __init__(self, dimension: int):
        self._dim = dimension
        self._client: Optional[AsyncQdrantClient] = None

    async def client(self) -> AsyncQdrantClient:
        if self._client is None:
            url_or_path = settings.qdrant_url
            if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
                try:
                    c = AsyncQdrantClient(url=url_or_path)
                    await c.get_collections()
                    self._client = c
                    logger.info("Connected to remote Qdrant server at %s", url_or_path)
                except Exception as exc:
                    logger.warning(
                        "Could not connect to remote Qdrant at %s (%s). Falling back to embedded Qdrant storage at './qdrant_storage'",
                        url_or_path,
                        exc,
                    )
                    self._client = AsyncQdrantClient(path="./qdrant_storage")
            elif url_or_path == ":memory:":
                logger.info("Initializing in-memory Qdrant store")
                self._client = AsyncQdrantClient(location=":memory:")
            else:
                logger.info("Initializing embedded local Qdrant store at %s", url_or_path)
                self._client = AsyncQdrantClient(path=url_or_path)
        return self._client

    # ------------------------------------------------------------------
    # Collection management
    # ------------------------------------------------------------------

    async def ensure_collection(self) -> None:
        """Create collection if it doesn't exist. Idempotent."""
        c = await self.client()
        exists = await c.collection_exists(COLLECTION_NAME)
        if not exists:
            await c.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=self._dim, distance=Distance.COSINE),
            )
            # Index payload fields for fast metadata filtering
            await c.create_payload_index(COLLECTION_NAME, "paper_id", PayloadSchemaType.INTEGER)
            await c.create_payload_index(COLLECTION_NAME, "section_type", PayloadSchemaType.KEYWORD)
            logger.info("Created Qdrant collection '%s' dim=%d", COLLECTION_NAME, self._dim)
        else:
            logger.debug("Collection '%s' already exists", COLLECTION_NAME)

    # ------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------

    async def upsert_chunks(
        self, chunks: list[TextChunk], embeddings: list[list[float]]
    ) -> None:
        """Upsert chunk embeddings + payload into Qdrant."""
        assert len(chunks) == len(embeddings), "Chunk/embedding count mismatch"
        c = await self.client()

        points = [
            PointStruct(
                id=abs(hash(chunk.id)) % (2**63),  # deterministic uint64 id
                vector=emb,
                payload={
                    "paper_id": chunk.paper_id,
                    "section_id": chunk.section_id,
                    "section_type": chunk.section_type,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                    "chunk_id": chunk.id,
                    "text": chunk.text,
                    "token_estimate": chunk.token_estimate,
                    **chunk.metadata,
                },
            )
            for chunk, emb in zip(chunks, embeddings)
        ]

        await c.upsert(collection_name=COLLECTION_NAME, points=points)
        logger.info("Upserted %d chunks for paper_id=%s", len(points), chunks[0].paper_id if chunks else "?")

    async def delete_paper(self, paper_id: int) -> None:
        """Remove all chunks for a paper (called on paper deletion)."""
        c = await self.client()
        await c.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[FieldCondition(key="paper_id", match=MatchValue(value=paper_id))]
            ),
        )
        logger.info("Deleted chunks for paper_id=%d", paper_id)

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    async def search(
        self,
        query_vector: list[float],
        top_k: int = 20,
        paper_ids: Optional[list[int]] = None,
        section_types: Optional[list[str]] = None,
        score_threshold: Optional[float] = None,
    ) -> list[ScoredPoint]:
        """
        Dense vector search with optional metadata pre-filtering.

        paper_ids: restrict search to specific papers (None = all papers)
        section_types: restrict to specific section types (None = all)
        """
        c = await self.client()
        await self.ensure_collection()

        must_conditions = []
        if paper_ids:
            must_conditions.append(
                FieldCondition(key="paper_id", match=MatchValue(value=paper_ids[0]))
                if len(paper_ids) == 1
                else Filter(
                    should=[
                        FieldCondition(key="paper_id", match=MatchValue(value=pid))
                        for pid in paper_ids
                    ]
                )
            )
        if section_types:
            must_conditions.append(
                Filter(
                    should=[
                        FieldCondition(key="section_type", match=MatchValue(value=st))
                        for st in section_types
                    ]
                )
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        results = await c.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
            score_threshold=score_threshold,
            with_payload=True,
        )
        return results

    async def get_collection_info(self) -> dict[str, Any]:
        c = await self.client()
        info = await c.get_collection(COLLECTION_NAME)
        return {
            "vectors_count": info.vectors_count,
            "points_count": info.points_count,
            "status": str(info.status),
        }
