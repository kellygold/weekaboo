from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", extra="ignore")
    database_url: str = f"sqlite:///{BACKEND_ROOT.parent / 'data' / 'weekaboo.db'}"
    secret_key: str = Field(min_length=32)
    google_client_id: str = ""
    google_client_secret: str = ""
    microsoft_client_id: str = ""
    microsoft_client_secret: str = ""
    microsoft_sync_future_days: int = Field(default=365, ge=30, le=730)
    public_base_url: str = "http://localhost:8080"
    frontend_url: str = "http://127.0.0.1:5188"
    timezone: str = "Australia/Sydney"
    sync_interval_seconds: int = 300
    push_interval_seconds: int = 15
    sync_past_days: int = 90
    sync_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
