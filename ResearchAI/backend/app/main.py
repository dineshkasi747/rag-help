from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

load_dotenv()

from app.api.routes import api_router
from app.core.config import settings
from app.core.logger import setup_logging

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema management:
    #   - LOCAL (SQLite): create_all is used for zero-config dev convenience.
    #   - PRODUCTION (Render Postgres): schema is managed by Alembic migrations.
    #     Run: alembic upgrade head   before deploying or in the Render start command.
    from app.db.session import engine
    from app.db.base import Base
    from app.models import User, Paper, Section  # noqa: F401
    from app.core.config import settings as _s

    if "sqlite" in _s.database_url:
        # Dev-only: auto-create all tables from ORM models (no migration needed)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        # Self-healing check for new columns in production PostgreSQL
        try:
            from sqlalchemy import text
            async with engine.begin() as conn:
                await conn.execute(text("ALTER TABLE papers ADD COLUMN IF NOT EXISTS napkin_visuals TEXT;"))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Startup column check note: %s", e)

    # Initialize RAG pipeline (loads embedding model, connects to Qdrant)
    from app.services.rag.dependencies import init_rag
    init_rag()
    yield
    # Shutdown: nothing to clean up for now


app = FastAPI(
    title="ResearchMind AI",
    description="Backend API for the ResearchMind AI educational research assistant.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8181",
        "http://127.0.0.1:8181",
        # Vercel production frontend
        "https://rag-help-nlvk-one.vercel.app",
        # Render backend (self + any preview URLs)
        "https://rag-help.onrender.com",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/healthz")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "ResearchMind AI Backend"}
