"""
Application settings loaded from environment variables / .env file.
Using pydantic-settings v2 for type-safe config with env-var overrides.
"""

from pathlib import Path
from pydantic import Field, model_validator
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
    napkin_api_token: str = Field("", validation_alias="NAPKIN_API_TOKEN")

    # Cloudinary Cloud Storage Config
    cloudinary_cloud_name: str = Field("dspqls1bx", validation_alias="CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: str = Field("119591412111292", validation_alias="CLOUDINARY_API_KEY")
    cloudinary_api_secret: str = Field("hFakgbYtDywqE7D7OeiAOVnxdRo", validation_alias="CLOUDINARY_API_SECRET")

    model_config = {"env_file": str(BASE_DIR / ".env"), "case_sensitive": True, "extra": "ignore"}

    @model_validator(mode='after')
    def fix_database_url(self) -> 'Settings':
        if self.database_url:
            if self.database_url.startswith("postgres://"):
                self.database_url = self.database_url.replace("postgres://", "postgresql+psycopg://", 1)
            elif self.database_url.startswith("postgresql://"):
                self.database_url = self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self



settings = Settings()
