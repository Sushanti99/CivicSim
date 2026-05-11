from __future__ import annotations

from pydantic import BaseModel, Field


class Location(BaseModel):
    id: str = Field(..., description="Location identifier, e.g. 'region_west'.")
    label: str = Field(..., description="Human-readable name.")
    kind: str | None = Field(
        None,
        description="One of 'region', 'division', 'county'. Drives UI grouping and the prior backoff path.",
    )
    region: str | None = Field(None, description="Census region the location belongs to.")
    division: str | None = Field(None, description="Census division the location belongs to.")
    state: str | None = None
    population: int | None = Field(None, description="Approximate total population.")


class LocationsResponse(BaseModel):
    locations: list[Location]
