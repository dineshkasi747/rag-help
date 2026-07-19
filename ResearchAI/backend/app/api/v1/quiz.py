"""
Quiz API router — generates multiple choice quizzes based on paper contents.
"""

import json
import logging
import re
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.paper_service import PaperService
from app.services.rag.llm_provider import get_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizRequest(BaseModel):
    paper_id: int
    num_questions: int = Field(5, ge=1, le=10)


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


SYSTEM_PROMPT_TEMPLATE = """You are an expert academic examiner. Your task is to generate a challenging multiple-choice quiz based on the provided research paper content.

You MUST respond with a raw JSON array containing exactly {num_questions} questions.
Do NOT wrap the output in markdown code blocks (like ```json). Respond with ONLY the raw JSON string.

Each question object in the JSON array must follow this exact schema:
{{
  "question": "The question text.",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correct_index": 0, // 0-based index of the correct option (0, 1, 2, or 3)
  "explanation": "A detailed explanation of why this option is correct based on the text."
}}
"""


def _get_paper_service(db: AsyncSession = Depends(get_db)) -> PaperService:
    return PaperService(db)


@router.post("/generate", response_model=list[QuizQuestion])
async def generate_quiz(
    req: QuizRequest,
      current_user: Annotated[User, Depends(get_current_user)],
    service: PaperService = Depends(_get_paper_service),
):
    """
    Generate an interactive multiple choice quiz for a specific paper.
    Reads the paper content, summarizes key concepts, and generates MCQs using LLM.
    """
    paper = await service.get_paper(req.paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    sections = await service.get_sections(req.paper_id)
    if not sections:
        raise HTTPException(
            status_code=400,
            detail="The paper has no extracted sections. Please wait for it to process.",
        )

    # Concatenate all section headings and text up to a safe limit
    text_parts = []
    for s in sections:
        heading = s.heading or s.section_type.replace("_", " ").title()
        text_parts.append(f"## {heading}\n{s.content}")

    full_text = "\n\n".join(text_parts)
    # Truncate text to avoid exceeding LLM context limits (roughly ~40-50k chars is plenty for a quiz)
    full_text = full_text[:50000]

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(num_questions=req.num_questions)
    user_prompt = f"Generate a quiz of {req.num_questions} questions based on this text:\n\n{full_text}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        llm = get_llm()
        raw_response = await llm.complete(messages)
        
        # Clean up response in case the LLM wrapped it in markdown code blocks
        clean_json = raw_response.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\n", "", clean_json)
            clean_json = re.sub(r"\n```$", "", clean_json)
        clean_json = clean_json.strip()

        quiz_data = json.loads(clean_json)
        if not isinstance(quiz_data, list):
            raise ValueError("LLM did not return a list")

        # Basic structure validation
        validated_quiz = []
        for q in quiz_data:
            validated_quiz.append(
                QuizQuestion(
                    question=str(q.get("question", "")),
                    options=[str(opt) for opt in q.get("options", [])[:4]],
                    correct_index=int(q.get("correct_index", 0)),
                    explanation=str(q.get("explanation", "")),
                )
            )

        return validated_quiz

    except json.JSONDecodeError as jde:
        logger.error("Failed to decode JSON from LLM response. Raw output: %s", raw_response)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to generate a valid quiz. The AI response was malformed. Please try again.",
        )
    except Exception as e:
        logger.exception("Quiz generation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during quiz generation: {str(e)}",
        )
