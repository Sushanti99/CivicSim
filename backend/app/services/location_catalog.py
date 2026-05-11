"""Catalog of supported locations.

The catalog is read from ``data/locations/_catalog.json`` (produced by
``scripts/build_locations.py``). Falls back to a hard-coded entry for Alameda
County so the demo runs even before the builder is invoked.

Each entry carries:
    id        — unique location ID (matches the directory in data/locations/)
    label     — human-readable name (renders in the dropdown)
    kind      — one of "region" | "division" | "county"
    region    — Census region this location maps to (None for unknown)
    division  — Census division (None for region-only or county-only entries)
    population— approximate population for sorting / display
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from app.models.locations import Location

logger = logging.getLogger(__name__)


# Hard-coded entry for the bundled county example. Counties have no ATP prior
# of their own — they fall back to the parent region's prior, which we surface
# in the UI as a small "fallback" tag.
_COUNTIES: list[Location] = [
    Location(
        id="alameda_california",
        label="Alameda County, CA",
        kind="county",
        region="West",
        division="Pacific",
        state="California",
        population=1_658_000,
    ),
]


@lru_cache(maxsize=1)
def _load_catalog() -> list[Location]:
    repo_root = Path(__file__).resolve().parents[3]
    catalog_path = repo_root / "data" / "locations" / "_catalog.json"
    items: list[Location] = []
    if catalog_path.exists():
        try:
            raw = json.loads(catalog_path.read_text())
            for entry in raw:
                items.append(
                    Location(
                        id=entry["id"],
                        label=entry["label"],
                        kind=entry.get("kind"),
                        region=entry.get("region"),
                        division=entry.get("division"),
                        state=entry.get("state"),
                        population=entry.get("population"),
                    )
                )
        except (OSError, ValueError, KeyError) as exc:
            logger.warning("Failed to read locations catalog at %s: %s", catalog_path, exc)
    items.extend(_COUNTIES)
    return items


def list_location_catalog() -> list[Location]:
    from civicsim_agents import list_locations as _list

    available = set(_list())
    return [loc for loc in _load_catalog() if loc.id in available]


def get_location(location_id: str) -> Location | None:
    for loc in _load_catalog():
        if loc.id == location_id:
            return loc
    return None


def geo_for(location_id: str) -> dict[str, str]:
    """Return the region/division dict for a location (for prior lookup)."""
    loc = get_location(location_id)
    if not loc:
        return {}
    out: dict[str, str] = {}
    if loc.region:
        out["region"] = loc.region
    if loc.division:
        out["division"] = loc.division
    return out
