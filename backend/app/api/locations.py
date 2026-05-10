"""GET /api/locations — list supported locations."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.locations import Location, LocationsResponse
from app.services.location_catalog import list_location_catalog

router = APIRouter()


@router.get("/locations", response_model=LocationsResponse)
def get_locations() -> LocationsResponse:
    items: list[Location] = list_location_catalog()
    return LocationsResponse(locations=items)
