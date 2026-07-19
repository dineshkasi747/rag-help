from fastapi import APIRouter
from app.api.v1 import health
from app.api.v1.papers import router as papers_router
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.quiz import router as quiz_router

api_router = APIRouter()
api_router.include_router(health.router, prefix="", tags=["Health"])
api_router.include_router(auth_router, prefix="/v1")
api_router.include_router(papers_router, prefix="/v1")
api_router.include_router(chat_router, prefix="/v1")
api_router.include_router(quiz_router, prefix="/v1")
