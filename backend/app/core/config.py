import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Leaderboard System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "CHANGE_THIS_IN_PRODUCTION_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://user:password@localhost/leaderboard"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Backend URL for generating absolute URLs
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")

    # Paths
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./data/uploads")
    LOG_DIR: str = os.getenv("LOG_DIR", "./data/logs")
    HOST_UPLOAD_DIR: str = os.getenv("HOST_UPLOAD_DIR", "/tmp")

    # Init
    FIRST_SUPERUSER: str = "admin"
    FIRST_SUPERUSER_PASSWORD: str = "admin"

    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]

    class Config:
        case_sensitive = True


settings = Settings()
