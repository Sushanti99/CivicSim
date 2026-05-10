"""Catalog of supported locations.

For v1 we ship only Alameda County, CA. Adding a new location is two steps:
drop the four CSVs into ``packages/civicsim_agents/civicsim_agents/data/<id>/``
and add an entry below.
"""

from __future__ import annotations

from app.models.locations import Location

_CATALOG: list[Location] = [
    Location(
        id="alameda_california",
        label="Alameda County, CA",
        state="California",
        population=1_658_000,
    ),
]


def list_location_catalog() -> list[Location]:
    # Filter to those actually present in the bundled package data.
    from civicsim_agents import list_locations as _list

    available = set(_list())
    return [loc for loc in _CATALOG if loc.id in available]
