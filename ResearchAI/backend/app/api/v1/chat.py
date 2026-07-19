"""
Chat API — citation-grounded RAG chat with SSE streaming.

Endpoints:
- POST /chat/stream  — SSE streaming chat (primary)
- POST /chat         — non-streaming (useful for testing)
"""

from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.rag.dependencies import get_pipeline
from app.services.rag.pipeline import EXPLANATION_MODES

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str
    paper_ids: Optional[list[int]] = None       # None = search all papers
    mode: str = "grad"                           # explanation mode
    history: Optional[list[dict]] = None         # [{role, content}, ...]


@router.post("/stream")
async def stream_chat(
    req: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    SSE streaming chat endpoint.
    Frontend should use EventSource or fetch with streaming body.

    Event types:
    - context: {citations: [...]}  — emitted before generation
    - delta: {text: "..."}         — streamed tokens
    - done: {}                     — stream complete
    - error: {message: "..."}      — on failure
    """
    if req.mode not in EXPLANATION_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode. Choose from: {list(EXPLANATION_MODES.keys())}",
        )

    pipeline = get_pipeline()

    async def event_generator():
        try:
            async for chunk in pipeline.stream_answer(
                query=req.query,
                paper_ids=req.paper_ids,
                mode=req.mode,
                conversation_history=req.history,
            ):
                yield chunk
        except Exception as e:
            import json
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("")
async def chat(
    req: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Non-streaming chat — returns full response at once."""
    if req.mode not in EXPLANATION_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode.")

    pipeline = get_pipeline()
    result = await pipeline.answer(
        query=req.query,
        paper_ids=req.paper_ids,
        mode=req.mode,
        conversation_history=req.history,
    )
    return {
        "answer": result.answer,
        "citations": [
            {
                "section_type": c.section_type,
                "page_number": c.page_number,
                "preview": c.text,
                "score": round(c.relevance_score, 3),
            }
            for c in result.citations
        ],
        "mode": result.explanation_mode,
    }


@router.get("/modes")
async def get_modes():
    """Return available explanation modes."""
    return {"modes": list(EXPLANATION_MODES.keys()), "descriptions": EXPLANATION_MODES}
