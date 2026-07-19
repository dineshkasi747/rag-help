from fastapi import APIRouter

router = APIRouter()

@router.get("/health", summary="Health check")
def health() -> dict[str, str]:
    return {"status": "healthy", "app": "ResearchMind AI"}
