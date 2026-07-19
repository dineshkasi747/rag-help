"""
Paper repository — all DB operations for papers and sections.

Following the Repository Pattern: business logic never touches SQLAlchemy
directly; it goes through this layer, making the service testable with mocks.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.paper import Paper, ProcessingStatus, Section

logger = logging.getLogger(__name__)


class PaperRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    async def get_by_hash(self, sha256: str) -> Optional[Paper]:
        result = await self._db.execute(
            select(Paper).where(Paper.sha256_hash == sha256)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, paper_id: int) -> Optional[Paper]:
        result = await self._db.execute(
            select(Paper).where(Paper.id == paper_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, skip: int = 0, limit: int = 50) -> list[Paper]:
        result = await self._db.execute(
            select(Paper).order_by(Paper.uploaded_at.desc()).offset(skip).limit(limit)
        )
        return list(result.scalars().all())

    async def get_sections(self, paper_id: int) -> list[Section]:
        result = await self._db.execute(
            select(Section)
            .where(Section.paper_id == paper_id)
            .order_by(Section.order_index)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    async def create(self, paper: Paper) -> Paper:
        self._db.add(paper)
        await self._db.commit()
        await self._db.refresh(paper)
        logger.info("Created paper id=%s hash=%s", paper.id, paper.sha256_hash)
        return paper

    async def update_status(
        self,
        paper_id: int,
        status: ProcessingStatus,
        error_message: Optional[str] = None,
    ) -> None:
        paper = await self.get_by_id(paper_id)
        if not paper:
            return
        paper.status = status
        if error_message:
            paper.error_message = error_message
        if status == ProcessingStatus.COMPLETED:
            paper.processed_at = datetime.now(timezone.utc)
        await self._db.commit()

    async def update_metadata(self, paper_id: int, **kwargs) -> None:
        paper = await self.get_by_id(paper_id)
        if not paper:
            return
        for key, value in kwargs.items():
            # Serialize lists to JSON strings for storage
            if isinstance(value, list):
                value = json.dumps(value)
            setattr(paper, key, value)
        await self._db.commit()

    async def create_sections(self, sections: list[Section]) -> None:
        self._db.add_all(sections)
        await self._db.commit()
