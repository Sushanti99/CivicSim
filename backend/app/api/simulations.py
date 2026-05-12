"""GET /api/simulations — browse persisted simulation runs."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.simulation_store import delete_simulation, get_simulation, list_simulations

router = APIRouter()


@router.get("/simulations")
def get_simulations(limit: int = 20) -> list[dict]:
    """Return recent simulations (newest first), with summary if complete."""
    return list_simulations(limit=min(limit, 100))


@router.get("/simulations/{sim_id}")
def get_simulation_by_id(sim_id: str) -> dict:
    """Return the full data for a simulation (meta + all agents + summary)."""
    data = get_simulation(sim_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Simulation not found: {sim_id!r}")
    return data


@router.delete("/simulations/{sim_id}", status_code=204)
def delete_simulation_by_id(sim_id: str) -> None:
    """Permanently delete a simulation folder and all its files."""
    deleted = delete_simulation(sim_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Simulation not found: {sim_id!r}")
