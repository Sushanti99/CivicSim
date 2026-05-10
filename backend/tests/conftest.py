"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parents[2]
PRIORS_PATH = REPO_ROOT / "data" / "atp_priors" / "policy_priors.parquet"


@pytest.fixture(scope="session", autouse=True)
def _ensure_priors_exist():
    if PRIORS_PATH.exists():
        return
    subprocess.check_call(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "build_atp_priors.py"),
            "--synthetic",
            "--out",
            str(PRIORS_PATH),
        ],
        cwd=REPO_ROOT,
    )


@pytest.fixture(scope="session", autouse=True)
def _set_env(_ensure_priors_exist):
    os.environ.setdefault("LLM_PROVIDER", "mock")
    os.environ.setdefault("ATP_PRIORS_PATH", str(PRIORS_PATH))
    # Force a fresh Settings object that picks these up.
    from app.core import config

    config.get_settings.cache_clear()
    yield


@pytest.fixture
def client(_set_env) -> TestClient:
    from app.main import create_app

    app = create_app()
    with TestClient(app) as c:
        yield c
