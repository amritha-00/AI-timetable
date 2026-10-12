"""
Application configuration.

All settings are loaded from environment variables (and a local `.env` file
during development). Nothing sensitive is hardcoded here - see `.env.example`
at the project root for the full list of variables this app understands.
"""
from functools import lru_cache
from pathlib import Path
from typing import List, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root is two levels above this file: backend/app/config.py -> backend -> root
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    # ---------- App ----------
    app_env: str = "development"
    app_debug: bool = True
    app_secret_key: str = "change-me"
    # Platform-owner login (not a tenant) - see app/routers/admin.py. Demo-grade:
    # a plain comparison against .env, not its own hashed-password table.
    admin_email: str = "admin@timetable.local"
    admin_password: str = "change-me-admin"
    backend_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ---------- Database ----------
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_password: str = ""
    db_name: str = "timetable_ai"
    database_url: str | None = None  # optional full override

    # ---------- LLM ----------
    # "mock" is a deterministic offline provider for dev/testing - see app/llm/mock_provider.py
    llm_provider: Literal["anthropic", "bedrock", "gemini", "mock"] = "anthropic"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5"

    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    bedrock_model_id: str = "amazon.nova-pro-v1:0"

    # Google Gemini - free tier via https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    # ---------- Solver ----------
    solver_max_seconds: int = 30
    solver_num_workers: int = 8

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        """Build the SQLAlchemy connection string for MySQL via PyMySQL."""
        if self.database_url:
            # Managed MySQL hosts (Aiven, etc.) hand you a bare "mysql://..."
            # URI to copy-paste - SQLAlchemy then defaults to the MySQLdb
            # driver, which isn't installed (we use PyMySQL). Normalize it
            # here so pasting that URI in as-is just works, instead of
            # failing at import time with "No module named 'MySQLdb'".
            url = self.database_url
            if url.startswith("mysql://"):
                url = "mysql+pymysql://" + url[len("mysql://") :]
            # Aiven's URI also appends "?ssl-mode=REQUIRED" - a MySQL
            # Connector/Python-style param PyMySQL doesn't recognize (the
            # hyphen isn't even a valid keyword argument name, so it fails
            # differently than a missing driver would). TLS is already
            # handled explicitly in app/db/session.py's connect_args, so
            # this query param is just dropped here, leaving any others.
            parsed = urlsplit(url)
            query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k != "ssl-mode"]
            url = urlunsplit(parsed._replace(query=urlencode(query)))
            return url
        return (
            f"mysql+pymysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton - avoids re-parsing .env on every call."""
    return Settings()


settings = get_settings()
