"""Domain catalog — loads domain_demographics.json and exposes helpers."""

from __future__ import annotations

import json
import threading
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

_lock = threading.Lock()


def _catalog_path() -> Path:
    settings = get_settings()
    # Same data-root logic as ATP priors
    base = settings.atp_priors_resolved_path.parent
    return base / "domain_demographics.json"


@lru_cache(maxsize=1)
def _load_catalog() -> dict:
    path = _catalog_path()
    if not path.exists():
        # Return an empty catalog rather than crashing — real domains won't be
        # shown, but the rest of the app continues to function.
        return {}
    return json.loads(path.read_text())


def list_domains() -> list[dict]:
    """Return all domains as a list, ordered by label."""
    catalog = _load_catalog()
    result = []
    for domain_id, meta in catalog.items():
        result.append({"id": domain_id, **meta})
    return sorted(result, key=lambda d: d["label"])


def get_domain(domain_id: str) -> dict | None:
    """Return a single domain dict (with ``id`` key), or None if not found."""
    catalog = _load_catalog()
    meta = catalog.get(domain_id)
    if meta is None:
        return None
    return {"id": domain_id, **meta}


def domain_question_ids(domain_id: str) -> list[str]:
    """Return the curated ATP question IDs for a domain."""
    d = get_domain(domain_id)
    if d is None:
        return []
    return d.get("question_ids", [])


def domain_auto_dims(domain_id: str) -> list[str]:
    """Return the ATP column keys that are auto-selected for a domain."""
    d = get_domain(domain_id)
    if d is None:
        return []
    return [dim["key"] for dim in d.get("dimensions", []) if dim.get("auto_selected")]
