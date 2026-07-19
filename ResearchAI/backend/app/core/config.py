"""
Application settings loaded from environment variables / .env file.
Using pydantic-settings v2 for type-safe config with env-var overrides.
"""

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    app_name: str = "ResearchMind AI"
    environment: str = Field("development", validation_alias="ENVIRONMENT")
    database_url: str = Field(
        "sqlite+aiosqlite:///./researchmind.db",
        validation_alias="DATABASE_URL",
    )
    qdrant_url: str = Field("./qdrant_storage", validation_alias="QDRANT_URL")
    jwt_secret: str = Field("change-me", validation_alias="RM_JWT_SECRET")
    jwt_algorithm: str = Field("HS256", validation_alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(60 * 24, validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    upload_dir: str = Field("./uploads", validation_alias="UPLOAD_DIR")

    model_config = {"env_file": str(BASE_DIR / ".env"), "case_sensitive": True, "extra": "ignore"}


settings = Settings()
