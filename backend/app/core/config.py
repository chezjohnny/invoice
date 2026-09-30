from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Relative to the working directory: backend/dev.db, also shared with the
    # Docker dev stack, which mounts backend/ onto /app.
    database_url: str = "sqlite+aiosqlite:///./dev.db"
    secret_key: str = "dev-insecure-change-me-in-production-secret"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    model_config = {"env_file": ".env", "env_prefix": "INVOICE_"}


settings = Settings()
