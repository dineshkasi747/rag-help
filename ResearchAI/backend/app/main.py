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
    # Startup: ensure DB tables exist (creates SQLite or Postgres schema automatically)
    from app.db.session import engine
    from app.db.base import Base
    from app.models import User, Paper, Section  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
        "http://127.0.0.1:8181"
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
