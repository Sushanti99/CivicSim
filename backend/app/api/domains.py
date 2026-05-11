"""GET /api/domains — domain catalog for the CivicSim UI."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.domain_catalog import get_domain, list_domains

router = APIRouter()


@router.get("/domains")
def get_domains() -> list[dict]:
    """Return all domains with their ranked dimensions and needs_geo flag."""
    return list_domains()


@router.get("/domains/{domain_id}")
def get_domain_by_id(domain_id: str) -> dict:
    """Return a single domain's metadata."""
    d = get_domain(domain_id)
    if d is None:
        raise HTTPException(status_code=404, detail=f"Unknown domain: {domain_id!r}")
    return d
