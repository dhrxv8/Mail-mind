from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Security
    SECRET_KEY: str
    ENCRYPTION_KEY: str  # base64-encoded 32-byte key (AES-256)

    # JWT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/auth/google/callback"

    # Gmail Pub/Sub (Phase 3)
    # Full topic resource name: projects/<gcp-project>/topics/<topic-name>
    PUBSUB_TOPIC: str = ""
    # Shared secret appended as ?token= on the webhook URL for lightweight auth
    PUBSUB_VERIFICATION_TOKEN: str = ""

    # Stripe (Phase 7) — leave blank to run without billing in development
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_PRO: str = ""

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    APP_ENV: str = "development"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return v

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def encryption_key_valid(cls, v: str) -> str:
        import base64

        try:
            raw = base64.b64decode(v)
        except Exception:
            raise ValueError("ENCRYPTION_KEY must be a valid base64 string")
        if len(raw) != 32:
            raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)")
        return v

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
