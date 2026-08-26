"""
FastAPI dependency for authenticated routes.

get_current_user() is injected into any route that needs authentication.
It reads the Bearer token from the Authorization header, validates it,
and returns the User ORM object — or raises 401.
"""

import logging
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_subject
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=True)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    db: AsyncSession = Depends(get_db),
) -> User:
    subject = get_subject(credentials.credentials)
    if not subject:
        raise _UNAUTHORIZED

    repo = UserRepository(db)
    user = await repo.get_by_email(subject)
    if not user:
        raise _UNAUTHORIZED

    return user


_bearer_optional = HTTPBearer(auto_error=False)


async def get_optional_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer_optional)] = None,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    if not credentials or not credentials.credentials:
        return None
    subject = get_subject(credentials.credentials)
    if not subject:
        return None
    repo = UserRepository(db)
    return await repo.get_by_email(subject)
