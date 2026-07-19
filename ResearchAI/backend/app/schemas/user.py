from datetime import datetime
from pydantic import BaseModel, EmailStr

from typing import Optional
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserRead(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
