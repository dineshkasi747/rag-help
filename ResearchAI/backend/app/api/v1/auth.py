"""Auth API router — register, login, refresh, me."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, service: AuthService = Depends(_get_service)):
    """Create a new account and return tokens immediately."""
    return await service.register(req)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, service: AuthService = Depends(_get_service)):
    return await service.login(req)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: dict, service: AuthService = Depends(_get_service)):
    """Accept {refresh_token: str} and return new token pair."""
    return await service.refresh(body.get("refresh_token", ""))


@router.get("/me", response_model=UserRead)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
