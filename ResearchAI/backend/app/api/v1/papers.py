"""
Papers API router.
Routes are thin: validate HTTP, delegate to PaperService, return schema.
"""

import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.paper import PaperMetadata, PaperRead, PaperUploadResponse, SectionRead
from app.services.paper_service import PaperService

router = APIRouter(prefix="/papers", tags=["papers"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME = {"application/pdf"}


def _get_service(db: AsyncSession = Depends(get_db)) -> PaperService:
    return PaperService(db)


@router.post("/upload", response_model=PaperUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    service: PaperService = Depends(_get_service),
):
    """
    Accept a PDF upload, detect duplicates, persist, and queue background parsing.
    Returns 202 Accepted immediately — poll GET /papers/{id} for status.
    """
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are supported.",
        )
    # Size guard (read handled inside service, but check header hint)
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 50 MB limit.")

    result = await service.ingest_upload(file)

    # Only queue parsing for new uploads (not duplicates)
    if "already exists" not in result.message:
        background_tasks.add_task(service.process_paper, result.id)

    return result


@router.post("/upload/batch", response_model=list[PaperUploadResponse], status_code=status.HTTP_202_ACCEPTED)
async def upload_papers_batch(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    service: PaperService = Depends(_get_service),
):
    """Upload multiple PDFs in one request."""
    results = []
    for file in files:
        if file.content_type not in ALLOWED_MIME:
            continue  # silently skip non-PDFs in batch
        result = await service.ingest_upload(file)
        if "already exists" not in result.message:
            background_tasks.add_task(service.process_paper, result.id)
        results.append(result)
    return results


@router.get("", response_model=list[PaperRead])
async def list_papers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: PaperService = Depends(_get_service),
):
    papers = await service.list_papers(skip=skip, limit=limit)
    return [_to_paper_read(p) for p in papers]


@router.get("/{paper_id}", response_model=PaperRead)
async def get_paper(paper_id: int, service: PaperService = Depends(_get_service)):
    paper = await service.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return _to_paper_read(paper)


@router.get("/{paper_id}/sections", response_model=list[SectionRead])
async def get_sections(paper_id: int, service: PaperService = Depends(_get_service)):
    paper = await service.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return await service.get_sections(paper_id)


@router.get("/{paper_id}/summary")
async def get_paper_summary(paper_id: int, service: PaperService = Depends(_get_service)):
    paper = await service.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return await service.generate_paper_summary(paper_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json_field(value: Optional[str]) -> Optional[list]:
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        return [value]


def _to_paper_read(paper) -> PaperRead:
    return PaperRead(
        id=paper.id,
        original_filename=paper.original_filename,
        sha256_hash=paper.sha256_hash,
        file_size_bytes=paper.file_size_bytes,
        status=paper.status,
        error_message=paper.error_message,
        uploaded_at=paper.uploaded_at,
        processed_at=paper.processed_at,
        metadata=PaperMetadata(
            title=paper.title,
            authors=_parse_json_field(paper.authors),
            affiliations=_parse_json_field(paper.affiliations),
            abstract=paper.abstract,
            keywords=_parse_json_field(paper.keywords),
            publication_year=paper.publication_year,
            doi=paper.doi,
            journal_or_venue=paper.journal_or_venue,
            page_count=paper.page_count,
        ),
    )
