"""Backend configuration via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    atp_priors_path: str = Field(
        default="../data/atp_priors/policy_priors.parquet",
        description="Path to the bundled ATP priors parquet, resolved relative to backend/.",
    )

    llm_provider: Literal["mock", "openai", "anthropic"] = "mock"
    llm_model: str = "gpt-4o-mini"
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def atp_priors_resolved_path(self) -> Path:
        p = Path(self.atp_priors_path)
        if not p.is_absolute():
            p = (Path(__file__).resolve().parents[2] / p).resolve()
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
