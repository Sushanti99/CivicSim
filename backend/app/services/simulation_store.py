"""Simulation persistence layer.

When a simulation runs, a folder is created at::

    data/simulations/<sim_id>/

Containing:
- ``_meta.json``         — request parameters + resolved question
- ``agent_NNN.json``     — one file per agent (demographics + prior + stance + rationale)
- ``_summary.json``      — aggregate opinion distribution

The sim_id format is ``NNN__{location}__{domain}__{YYYYMMDD_HHMMSS}`` where NNN
is a zero-padded auto-incrementing serial number across all runs.

The folder lives under ``CIVICSIM_DATA_ROOT/simulations/`` (defaults to
``<repo root>/data/simulations/``).
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_serial_lock = threading.Lock()


def _simulations_root() -> Path:
    env = os.environ.get("CIVICSIM_DATA_ROOT")
    if env:
        return Path(env) / "simulations"
    # Walk up from this file to the repo root and look for data/
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "data" / "simulations"
        if (parent / "data").is_dir():
            return candidate
    return Path("data") / "simulations"


def _next_serial() -> int:
    """Scan existing folders for the highest serial prefix and return next."""
    root = _simulations_root()
    max_serial = 0
    if root.exists():
        for folder in root.iterdir():
            if folder.is_dir():
                try:
                    max_serial = max(max_serial, int(folder.name.split("__")[0]))
                except (ValueError, IndexError):
                    pass
    return max_serial + 1


def make_sim_id(location: str, domain: str | None) -> str:
    with _serial_lock:
        serial = _next_serial()
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
        domain_slug = (domain or "general").replace(" ", "_")
        loc_slug = location.replace(" ", "_")
        return f"{serial:03d}__{loc_slug}__{domain_slug}__{ts}"


class SimulationStore:
    """Context object for a single simulation run.

    Usage::

        store = SimulationStore.create(sim_id, meta)
        store.write_agent(agent_index, agent_data)
        store.write_summary(summary_data)
    """

    def __init__(self, sim_id: str, folder: Path) -> None:
        self.sim_id = sim_id
        self.folder = folder

    @classmethod
    def create(cls, sim_id: str, meta: dict) -> SimulationStore:
        folder = _simulations_root() / sim_id
        folder.mkdir(parents=True, exist_ok=True)
        meta_path = folder / "_meta.json"
        meta_path.write_text(json.dumps(meta, indent=2, default=str))
        logger.info("simulation_store: created %s", sim_id)
        return cls(sim_id, folder)

    def write_agent(self, index: int, data: dict) -> Path:
        """Write a per-agent JSON file.  Returns the path written."""
        path = self.folder / f"agent_{index:04d}.json"
        path.write_text(json.dumps(data, indent=2, default=str))
        return path

    def write_summary(self, data: dict) -> Path:
        path = self.folder / "_summary.json"
        path.write_text(json.dumps(data, indent=2, default=str))
        logger.info("simulation_store: summary written to %s", self.folder)
        return path


# ---------------------------------------------------------------------------
# Listing helpers
# ---------------------------------------------------------------------------

def list_simulations(limit: int = 50) -> list[dict]:
    """Return recent simulations (newest first) with their meta."""
    root = _simulations_root()
    if not root.exists():
        return []
    folders = sorted(
        (p for p in root.iterdir() if p.is_dir()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )[:limit]
    results = []
    for folder in folders:
        meta_path = folder / "_meta.json"
        summary_path = folder / "_summary.json"
        try:
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            summary = json.loads(summary_path.read_text()) if summary_path.exists() else None
            n_agents = len(list(folder.glob("agent_*.json")))
            results.append({
                "sim_id": folder.name,
                "n_agents": n_agents,
                "complete": summary_path.exists(),
                **meta,
                **({"summary": summary} if summary else {}),
            })
        except Exception:
            logger.warning("simulation_store: could not read %s", folder)
    return results


def delete_simulation(sim_id: str) -> bool:
    """Delete the simulation folder. Returns True if deleted, False if not found."""
    import shutil
    root = _simulations_root()
    folder = root / sim_id
    if not folder.is_dir():
        return False
    shutil.rmtree(folder)
    logger.info("simulation_store: deleted %s", sim_id)
    return True


def get_simulation(sim_id: str) -> dict | None:
    """Return full simulation data for a given sim_id, or None."""
    root = _simulations_root()
    folder = root / sim_id
    if not folder.is_dir():
        return None
    meta_path = folder / "_meta.json"
    summary_path = folder / "_summary.json"
    agent_files = sorted(folder.glob("agent_*.json"), key=lambda p: p.name)
    try:
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        summary = json.loads(summary_path.read_text()) if summary_path.exists() else None
        agents = [json.loads(p.read_text()) for p in agent_files]
        return {
            "sim_id": sim_id,
            **meta,
            "agents": agents,
            **({"summary": summary} if summary else {}),
        }
    except Exception:
        logger.warning("simulation_store: could not read %s", sim_id)
        return None
