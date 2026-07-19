"""
Auth service — register, login, refresh.
Owns all auth business rules; routes remain thin.
"""

import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, get_subject, REFRESH_TOKEN_TYPE
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse

logger = logging.getLogger(__name__)

_INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password.",
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self._repo = UserRepository(db)

    async def register(self, req: RegisterRequest) -> TokenResponse:
        if await self._repo.get_by_email(req.email):
            raise HTTPException(status_code=409, detail="Email already registered.")

        user = User(
            email=req.email,
            hashed_password=hash_password(req.password),
            full_name=req.full_name,
        )
        user = await self._repo.create(user)
        logger.info("Registered user id=%s email=%s", user.id, user.email)
        return _make_tokens(user.email)

    async def login(self, req: LoginRequest) -> TokenResponse:
        user = await self._repo.get_by_email(req.email)
        if not user or not verify_password(req.password, user.hashed_password):
            raise _INVALID_CREDENTIALS
        logger.info("Login user id=%s", user.id)
        return _make_tokens(user.email)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        subject = get_subject(refresh_token, expected_type=REFRESH_TOKEN_TYPE)
        if not subject:
            raise HTTPException(status_code=401, detail="Invalid refresh token.")
        user = await self._repo.get_by_email(subject)
        if not user:
            raise HTTPException(status_code=401, detail="User not found.")
        return _make_tokens(user.email)


def _make_tokens(email: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(email),
        refresh_token=create_refresh_token(email),
    )
