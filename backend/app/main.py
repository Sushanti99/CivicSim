"""FastAPI application factory for CivicSim."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import agents, locations, poll, simulate
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="CivicSim API",
        description="Demographically-grounded LLM simulation of public opinion.",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    @app.get("/healthz", tags=["meta"])
    def healthz() -> dict:
        return {
            "status": "ok",
            "version": app.version,
            "llm_provider": settings.llm_provider,
            "atp_priors_path": str(settings.atp_priors_resolved_path),
            "atp_priors_present": settings.atp_priors_resolved_path.exists(),
        }

    app.include_router(locations.router, prefix="/api", tags=["locations"])
    app.include_router(agents.router, prefix="/api", tags=["agents"])
    app.include_router(poll.router, prefix="/api", tags=["poll"])
    app.include_router(simulate.router, prefix="/api", tags=["simulate"])

    logger.info("CivicSim API ready", extra={"llm_provider": settings.llm_provider})
    return app


app = create_app()
