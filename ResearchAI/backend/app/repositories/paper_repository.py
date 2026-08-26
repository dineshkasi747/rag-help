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

from app.models.paper import Paper, Section
from app.core.config import settings

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

    async def get_system_stats(self) -> dict:
        from sqlalchemy import func
        total_papers = (await self._db.execute(select(func.count(Paper.id)))).scalar() or 0
        completed = (await self._db.execute(select(func.count(Paper.id)).where(Paper.status == 'completed'))).scalar() or 0
        processing = (await self._db.execute(select(func.count(Paper.id)).where(Paper.status == 'processing'))).scalar() or 0
        pending = (await self._db.execute(select(func.count(Paper.id)).where(Paper.status == 'pending'))).scalar() or 0
        failed = (await self._db.execute(select(func.count(Paper.id)).where(Paper.status == 'failed'))).scalar() or 0
        total_sections = (await self._db.execute(select(func.count(Section.id)))).scalar() or 0
        total_pages = (await self._db.execute(select(func.coalesce(func.sum(Paper.page_count), 0)))).scalar() or 0
        total_bytes = (await self._db.execute(select(func.coalesce(func.sum(Paper.file_size_bytes), 0)))).scalar() or 0
        visuals_count = (await self._db.execute(
            select(func.count(Paper.id)).where(Paper.napkin_visuals.isnot(None), Paper.napkin_visuals != '[]', Paper.napkin_visuals != '')
        )).scalar() or 0

        recent_res = await self._db.execute(select(Paper).order_by(Paper.uploaded_at.desc()).limit(5))
        recent_papers = recent_res.scalars().all()

        return {
            "total_papers": total_papers,
            "completed_papers": completed,
            "processing_papers": processing,
            "pending_papers": pending,
            "failed_papers": failed,
            "total_sections": total_sections,
            "total_pages": int(total_pages),
            "total_file_size_bytes": int(total_bytes),
            "visuals_count": visuals_count,
            "vector_chunks_count": total_sections * 3 if total_sections > 0 else 0,
            "active_models": {
                "llm": f"{settings.environment} / Groq LLaMA-3.3-70B",
                "embedding": "Google Gemini Embedding 001",
                "visualizer": "Napkin AI & Dynamic SVG Engine",
            },
            "recent_papers": [
                {
                    "id": p.id,
                    "title": p.title or p.original_filename,
                    "original_filename": p.original_filename,
                    "status": p.status,
                    "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else None,
                    "page_count": p.page_count,
                    "has_visuals": bool(p.napkin_visuals and p.napkin_visuals != "[]"),
                }
                for p in recent_papers
            ]
        }

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
        status: str,
        error_message: Optional[str] = None,
    ) -> None:
        paper = await self.get_by_id(paper_id)
        if not paper:
            return
        paper.status = status
        if error_message:
            paper.error_message = error_message
        if status == "completed":
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

    async def save_napkin_visuals(self, paper_id: int, visuals: list[dict]) -> None:
        """Persist Napkin AI generated visual data (list of {url, format} dicts) to the DB."""
        paper = await self.get_by_id(paper_id)
        if not paper:
            return
        paper.napkin_visuals = json.dumps(visuals)
        await self._db.commit()
        logger.info("Saved %d Napkin visuals for paper_id=%s", len(visuals), paper_id)

