from __future__ import annotations

from pydantic import BaseModel, Field


class Location(BaseModel):
    id: str = Field(..., description="Location identifier, e.g. 'alameda_california'.")
    label: str = Field(..., description="Human-readable name.")
    state: str | None = None
    population: int | None = Field(None, description="Approximate total population.")


class LocationsResponse(BaseModel):
    locations: list[Location]
