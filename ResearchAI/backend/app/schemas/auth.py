"""Pydantic schemas for auth endpoints."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


from typing import Optional

class UserRead(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None

    model_config = {"from_attributes": True}
