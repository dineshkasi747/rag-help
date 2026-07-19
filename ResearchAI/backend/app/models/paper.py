"""
SQLAlchemy ORM model for research papers.

Stores both file-level metadata (hash, path, status) and
extracted academic metadata (title, authors, DOI, etc.).
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum, ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.db.base import Base
import enum


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)

    # File identity — SHA-256 prevents duplicate ingestion
    sha256_hash = Column(String(64), unique=True, nullable=False, index=True)
    original_filename = Column(String(512), nullable=False)
    storage_path = Column(String(1024), nullable=False)  # relative path inside /uploads
    file_size_bytes = Column(Integer, nullable=False)

    # Processing lifecycle
    status = Column(
        Enum(ProcessingStatus, name="processing_status_enum"),
        nullable=False,
        default=ProcessingStatus.PENDING,
    )
    error_message = Column(Text, nullable=True)

    # Extracted academic metadata
    title = Column(String(1024), nullable=True)
    authors = Column(Text, nullable=True)          # JSON array string
    affiliations = Column(Text, nullable=True)     # JSON array string
    abstract = Column(Text, nullable=True)
    keywords = Column(Text, nullable=True)         # JSON array string
    publication_year = Column(Integer, nullable=True)
    doi = Column(String(256), nullable=True, index=True)
    journal_or_venue = Column(String(512), nullable=True)
    page_count = Column(Integer, nullable=True)

    # Timestamps
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships (populated in later milestones)
    sections = relationship("Section", back_populates="paper", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Paper id={self.id} title={self.title!r} status={self.status}>"


class Section(Base):
    """Represents a logical section extracted from a paper (Abstract, Introduction, etc.)."""

    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)

    section_type = Column(String(64), nullable=False)   # e.g. "abstract", "introduction"
    heading = Column(String(512), nullable=True)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)

    paper = relationship("Paper", back_populates="sections")

    def __repr__(self) -> str:
        return f"<Section id={self.id} type={self.section_type!r} paper_id={self.paper_id}>"
