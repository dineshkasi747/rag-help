from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from typing import Optional
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:
    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    async def create_user(self, db: AsyncSession, user_in: UserCreate) -> User:
        user = User(
            email=user_in.email,
            hashed_password=self.hash_password(user_in.password),
            full_name=user_in.full_name,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalars().first()
