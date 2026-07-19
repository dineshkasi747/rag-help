"""User repository — DB operations for User model."""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self._db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: int) -> Optional[User]:
        result = await self._db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)
        return user
