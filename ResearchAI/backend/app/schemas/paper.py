"""
Pydantic schemas for Paper endpoints.
Separating schemas from ORM models follows the clean architecture principle:
the API contract is decoupled from the persistence layer.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.paper import ProcessingStatus


class PaperUploadResponse(BaseModel):
    """Returned immediately after a file is accepted for processing."""
    id: int
    original_filename: str
    sha256_hash: str
    file_size_bytes: int
    status: ProcessingStatus
    message: str


class PaperMetadata(BaseModel):
    """Extracted academic metadata (populated after processing)."""
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    affiliations: Optional[list[str]] = None
    abstract: Optional[str] = None
    keywords: Optional[list[str]] = None
    publication_year: Optional[int] = None
    doi: Optional[str] = None
    journal_or_venue: Optional[str] = None
    page_count: Optional[int] = None


class PaperRead(BaseModel):
    """Full paper representation returned from GET endpoints."""
    id: int
    original_filename: str
    sha256_hash: str
    file_size_bytes: int
    status: ProcessingStatus
    error_message: Optional[str] = None
    uploaded_at: datetime
    processed_at: Optional[datetime] = None
    metadata: PaperMetadata

    model_config = {"from_attributes": True}


class SectionRead(BaseModel):
    id: int
    paper_id: int
    section_type: str
    heading: Optional[str]
    content: str
    page_number: Optional[int]
    order_index: int

    model_config = {"from_attributes": True}
