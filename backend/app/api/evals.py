"""GET /api/evals — per-simulation accuracy evaluation against ATP ground truth."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Make evals/ (repo root package) importable from inside backend/.
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _evaluator():
    try:
        from evals.evaluator import evaluate_sim_id, load_all_sim_ids  # type: ignore[import]
        return evaluate_sim_id, load_all_sim_ids
    except ImportError as exc:
        raise HTTPException(status_code=503, detail=f"Eval module unavailable: {exc}") from exc


def _format(ev) -> dict:
    result = ev.aggregate_summary()
    result["question_label"] = ev.question_label
    result["demographic_evals"] = [
        {"dim": de.dim, "value": de.value, "n_agents": de.n_agents,
         "tvd": round(de.tvd, 4), "hellinger": round(de.hellinger, 4)}
        for de in ev.demographic_evals
    ]
    return result


@router.get("/evals")
def get_all_evals() -> list[dict]:
    """Evaluate all saved simulations; return summary list (newest first)."""
    evaluate_sim_id, load_all_sim_ids = _evaluator()
    results = []
    for sid in load_all_sim_ids():
        ev = evaluate_sim_id(sid)
        if ev is not None:
            results.append(_format(ev))
    return results


@router.get("/evals/{sim_id}")
def get_eval_by_id(sim_id: str) -> dict:
    """Full eval for one simulation including per-agent results."""
    evaluate_sim_id, _ = _evaluator()
    ev = evaluate_sim_id(sim_id)
    if ev is None:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id!r} not found.")
    result = _format(ev)
    result["agent_evals"] = [a.summary() for a in ev.agent_evals]
    return result
