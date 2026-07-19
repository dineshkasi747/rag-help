"""Initial schema: users, papers, sections

Revision ID: 0001
Revises: 
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    op.create_table(
        "papers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("original_filename", sa.String(length=512), nullable=False),
        sa.Column("storage_path", sa.String(length=1024), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "completed", "failed", name="processing_status_enum"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=1024), nullable=True),
        sa.Column("authors", sa.Text(), nullable=True),
        sa.Column("affiliations", sa.Text(), nullable=True),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("publication_year", sa.Integer(), nullable=True),
        sa.Column("doi", sa.String(length=256), nullable=True),
        sa.Column("journal_or_venue", sa.String(length=512), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_papers_id", "papers", ["id"], unique=False)
    op.create_index("ix_papers_sha256_hash", "papers", ["sha256_hash"], unique=True)
    op.create_index("ix_papers_doi", "papers", ["doi"], unique=False)

    op.create_table(
        "sections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paper_id", sa.Integer(), nullable=False),
        sa.Column("section_type", sa.String(length=64), nullable=False),
        sa.Column("heading", sa.String(length=512), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["paper_id"], ["papers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sections_id", "sections", ["id"], unique=False)
    op.create_index("ix_sections_paper_id", "sections", ["paper_id"], unique=False)


def downgrade() -> None:
    op.drop_table("sections")
    op.drop_table("papers")
    op.execute("DROP TYPE IF EXISTS processing_status_enum")
    op.drop_table("users")
