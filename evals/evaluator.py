"""
Evaluate the accuracy and trustworthiness of CivicSim agent opinions.

Two main evaluation axes:

1. **Prior adherence (per-agent)**: Does the LLM's chosen stance agree with the
   ATP-derived prior distribution the agent was given?  Agents are more
   trustworthy when they pick high-probability answers for their demographic.

2. **Aggregate accuracy (simulation-level)**: Does the distribution of stances
   across all n agents match the real, population-level ATP polling distribution?

Loads simulation data from the on-disk store and the ATP priors parquet.
"""

from __future__ import annotations

import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ensure the backend package is importable when this module is run directly.
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND = _REPO_ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from evals.metrics import (  # noqa: E402
    answer_cis,
    expected_log_likelihood,
    kl_divergence,
    modal_answer,
    prior_as_dict,
    prior_in_ci_rate,
    prior_prob_of_stance,
    prior_rank_of_stance,
    stances_to_distribution,
    total_variation_distance,
    wasserstein_distance,
)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class AgentEval:
    """Per-agent evaluation result."""

    agent_id: int
    stance: str
    rationale: str
    prior: list[dict]

    # Whether the stance is one of the offered answer options.
    stance_valid: bool = False

    # ATP prior probability assigned to the chosen stance.
    prior_prob: float = 0.0

    # 1-indexed rank of stance within the prior (1 = modal answer).
    prior_rank: int = 0

    # True iff the agent chose the highest-probability answer.
    modal_agreement: bool = False

    # Demographic cell used for prior lookup (post-backoff).
    used_filter: dict = field(default_factory=dict)

    # Dimensions dropped during backoff (empty = no backoff needed).
    backoff_steps: list[str] = field(default_factory=list)

    def summary(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "stance": self.stance,
            "stance_valid": self.stance_valid,
            "prior_prob": round(self.prior_prob, 4),
            "prior_rank": self.prior_rank,
            "modal_agreement": self.modal_agreement,
            "backoff_steps": self.backoff_steps,
        }


@dataclass
class DemographicGroupEval:
    """TVD between the simulated distribution for a demographic slice and its ATP prior."""

    dim: str          # e.g. "age_group"
    value: str        # e.g. "30-49"
    n_agents: int
    simulated: dict[str, float]   # {answer_label: prob}
    prior: dict[str, float]       # {answer_label: prob}
    tvd: float = 0.0
    wasserstein: float = 0.0


@dataclass
class SimulationEval:
    """Aggregate evaluation result for one simulation run."""

    sim_id: str
    question_id: str
    question_label: str
    location: str
    n_agents: int

    # ---- Per-agent results ----
    agent_evals: list[AgentEval] = field(default_factory=list)

    # ---- Validity ----
    validity_rate: float = 0.0       # fraction of agents with a valid stance

    # ---- Prior adherence ----
    mean_prior_prob: float = 0.0     # avg P(stance | demographics) per ATP
    modal_agreement_rate: float = 0.0
    expected_log_likelihood: float = float("-inf")
    # Fraction of agents whose stance ranked in the top-2 of their prior.
    top2_rate: float = 0.0

    # ---- Aggregate accuracy vs. national (population-level) ATP prior ----
    national_prior: dict[str, float] = field(default_factory=dict)
    simulated_aggregate: dict[str, float] = field(default_factory=dict)
    tvd_vs_national: float = 1.0
    kl_vs_national: float = float("inf")
    wasserstein_vs_national: float = float("nan")

    # ---- Answer coverage ----
    # Fraction of valid answer options chosen by at least one agent.
    answer_coverage: float = 0.0

    # ---- Wilson 95% confidence intervals on simulated proportions ----
    # {answer_label: (lower, upper)}  — how precisely we estimate each answer share
    # given the finite number of agents.
    confidence_intervals: dict[str, tuple[float, float]] = field(default_factory=dict)

    # Fraction of answer options whose ATP national prior falls within the
    # simulated 95% CI.  1.0 = all ATP priors are statistically consistent
    # with the simulation; 0.0 = none are.
    prior_in_ci_rate: float = float("nan")

    # ---- Demographic breakdown ----
    demographic_evals: list[DemographicGroupEval] = field(default_factory=list)

    def aggregate_summary(self) -> dict:
        return {
            "sim_id": self.sim_id,
            "question_id": self.question_id,
            "location": self.location,
            "n_agents": self.n_agents,
            "validity_rate": round(self.validity_rate, 4),
            "mean_prior_prob": round(self.mean_prior_prob, 4),
            "modal_agreement_rate": round(self.modal_agreement_rate, 4),
            "top2_rate": round(self.top2_rate, 4),
            "expected_log_likelihood": round(self.expected_log_likelihood, 4),
            "tvd_vs_national": round(self.tvd_vs_national, 4),
            "kl_vs_national": round(self.kl_vs_national, 4),
            "wasserstein_vs_national": (
                round(self.wasserstein_vs_national, 4)
                if self.wasserstein_vs_national == self.wasserstein_vs_national
                else None
            ),
            "answer_coverage": round(self.answer_coverage, 4),
            "confidence_intervals": {
                k: (round(lo, 4), round(hi, 4))
                for k, (lo, hi) in self.confidence_intervals.items()
            },
            "prior_in_ci_rate": (
                round(self.prior_in_ci_rate, 4)
                if self.prior_in_ci_rate == self.prior_in_ci_rate  # not NaN
                else None
            ),
        }


# ---------------------------------------------------------------------------
# Core evaluation logic
# ---------------------------------------------------------------------------

def evaluate_simulation(
    sim_data: dict,
    national_prior: Optional[list[dict]] = None,
) -> SimulationEval:
    """Evaluate a loaded simulation dict (from simulation_store.get_simulation).

    national_prior: list[{"answer_label": str, "prob": float}] for the
    question at the population marginal.  If None, the distribution
    comparison metrics will be NaN.
    """
    meta = sim_data
    question_id: str = meta.get("question_id", "")
    question_label: str = meta.get("question_label", "")
    location: str = meta.get("location", "")
    sim_id: str = meta.get("sim_id", "")
    agent_records: list[dict] = sim_data.get("agents", [])

    # Collect answer options from the national prior or from per-agent priors.
    if national_prior:
        answer_options = [item["answer_label"] for item in national_prior]
    else:
        # Infer answer options from the first agent's prior.
        answer_options = [
            item["answer_label"]
            for item in (agent_records[0]["prior"] if agent_records else [])
        ]

    ev = SimulationEval(
        sim_id=sim_id,
        question_id=question_id,
        question_label=question_label,
        location=location,
        n_agents=len(agent_records),
    )

    # ---- Per-agent evaluation ----
    for rec in agent_records:
        prior = rec.get("prior", [])
        stance = rec.get("stance", "")
        rationale = rec.get("rationale", "")
        used_filter = rec.get("used_filter", {})
        backoff_steps = rec.get("backoff_steps", [])

        stance_valid = stance in answer_options
        p = prior_prob_of_stance(stance, prior)
        rank = prior_rank_of_stance(stance, prior)
        modal = modal_answer(prior)
        modal_agree = (stance == modal) if modal else False

        ae = AgentEval(
            agent_id=rec.get("agent_id", -1),
            stance=stance,
            rationale=rationale,
            prior=prior,
            stance_valid=stance_valid,
            prior_prob=p,
            prior_rank=rank,
            modal_agreement=modal_agree,
            used_filter=used_filter,
            backoff_steps=backoff_steps,
        )
        ev.agent_evals.append(ae)

    n = len(ev.agent_evals)
    if n == 0:
        return ev

    # ---- Validity ----
    ev.validity_rate = sum(1 for a in ev.agent_evals if a.stance_valid) / n

    # ---- Prior adherence ----
    ev.mean_prior_prob = sum(a.prior_prob for a in ev.agent_evals) / n
    ev.modal_agreement_rate = sum(1 for a in ev.agent_evals if a.modal_agreement) / n
    ev.top2_rate = sum(1 for a in ev.agent_evals if a.prior_rank <= 2) / n
    ev.expected_log_likelihood = expected_log_likelihood(
        [{"stance": a.stance, "prior": a.prior} for a in ev.agent_evals]
    )

    # ---- Aggregate distribution ----
    valid_stances = [a.stance for a in ev.agent_evals if a.stance_valid]
    ev.simulated_aggregate = stances_to_distribution(valid_stances, answer_options)

    if national_prior:
        ev.national_prior = prior_as_dict(national_prior)
        ev.tvd_vs_national = total_variation_distance(ev.national_prior, ev.simulated_aggregate)
        ev.kl_vs_national = kl_divergence(ev.national_prior, ev.simulated_aggregate)
        ev.wasserstein_vs_national = wasserstein_distance(ev.national_prior, ev.simulated_aggregate)
    else:
        ev.national_prior = {}
        ev.tvd_vs_national = float("nan")
        ev.kl_vs_national = float("nan")
        ev.wasserstein_vs_national = float("nan")

    # ---- Answer coverage ----
    stances_used = {a.stance for a in ev.agent_evals if a.stance_valid}
    ev.answer_coverage = len(stances_used) / max(len(answer_options), 1)

    # ---- Wilson 95% CIs on simulated proportions ----
    ev.confidence_intervals = answer_cis(ev.simulated_aggregate, n)
    if ev.national_prior:
        ev.prior_in_ci_rate = prior_in_ci_rate(ev.national_prior, ev.confidence_intervals)

    # ---- Demographic breakdown ----
    ev.demographic_evals = _demographic_breakdown(ev.agent_evals, answer_options)

    return ev


def _demographic_breakdown(
    agent_evals: list[AgentEval],
    answer_options: list[str],
) -> list[DemographicGroupEval]:
    """Compute per-group TVD between simulated distribution and per-group ATP prior."""
    DIMS = ["age_group", "race_eth", "income_group", "urbanicity"]
    results: list[DemographicGroupEval] = []

    for dim in DIMS:
        # Group agents by their value for this dimension.
        groups: dict[str, list[AgentEval]] = {}
        for ae in agent_evals:
            val = ae.used_filter.get(dim, "ALL")
            groups.setdefault(val, []).append(ae)

        for val, group_agents in groups.items():
            if val == "ALL" or len(group_agents) < 2:
                continue

            # Simulated distribution for this group.
            group_stances = [a.stance for a in group_agents if a.stance_valid]
            simulated = stances_to_distribution(group_stances, answer_options)

            # Use each agent's own prior as the "group prior" (already cell-specific).
            # Average the per-agent priors to get a representative group prior.
            prior_avg: dict[str, float] = {opt: 0.0 for opt in answer_options}
            for ae in group_agents:
                for item in ae.prior:
                    lbl = item["answer_label"]
                    if lbl in prior_avg:
                        prior_avg[lbl] += item["prob"]
            if group_agents:
                prior_avg = {k: v / len(group_agents) for k, v in prior_avg.items()}

            tvd = total_variation_distance(prior_avg, simulated)
            wass = wasserstein_distance(prior_avg, simulated)

            results.append(
                DemographicGroupEval(
                    dim=dim,
                    value=val,
                    n_agents=len(group_agents),
                    simulated=simulated,
                    prior=prior_avg,
                    tvd=tvd,
                    wasserstein=wass,
                )
            )

    return results


# ---------------------------------------------------------------------------
# Backend-aware loaders
# ---------------------------------------------------------------------------

def load_simulation(sim_id: str) -> Optional[dict]:
    """Load a simulation from the on-disk store."""
    try:
        from app.services.simulation_store import get_simulation
        return get_simulation(sim_id)
    except Exception as exc:
        logger.error("Could not load simulation %s: %s", sim_id, exc)
        return None


def load_all_sim_ids() -> list[str]:
    """Return all sim_ids from the simulation store (newest first)."""
    try:
        from app.services.simulation_store import list_simulations
        return [s["sim_id"] for s in list_simulations(limit=200)]
    except Exception as exc:
        logger.error("Could not list simulations: %s", exc)
        return []


def load_national_prior(question_id: str) -> Optional[list[dict]]:
    """Return the fully-marginal ATP prior for a question (no demographic filter).

    Tries the backend service first; falls back to reading the parquet directly
    with pandas or duckdb so the eval can run outside a full backend environment.
    """
    # --- Path 1: backend service (handles caching, config, backoff) ---
    try:
        from app.services.opinion_prior import lookup_distribution

        dist, _, _ = lookup_distribution(
            question_id=question_id,
            demographic_filter=None,
        )
        return [{"answer_label": p.answer_label, "prob": p.prob} for p in dist]
    except Exception:
        pass  # fall through to direct parquet read

    # --- Path 2: read priors parquet directly ---
    parquet_path = _REPO_ROOT / "data" / "atp_priors" / "policy_priors.parquet"
    if not parquet_path.exists():
        logger.warning("Priors parquet not found at %s", parquet_path)
        return None

    marginal_filter = "ALL"  # all dims = ALL → national marginal

    try:
        import pandas as pd

        df = pd.read_parquet(parquet_path)
        dim_cols = [c for c in df.columns if c not in ("question_id", "question_label", "answer_label", "prob")]
        mask = (df["question_id"] == question_id)
        for col in dim_cols:
            mask &= (df[col] == marginal_filter)
        rows = df[mask][["answer_label", "prob"]]
        if rows.empty:
            logger.warning("No national marginal found for %s in priors parquet", question_id)
            return None
        return [{"answer_label": r["answer_label"], "prob": float(r["prob"])} for _, r in rows.iterrows()]
    except ImportError:
        pass

    try:
        import duckdb

        con = duckdb.connect(":memory:")
        con.execute(f"CREATE VIEW priors AS SELECT * FROM read_parquet('{parquet_path.as_posix()}')")
        # Discover dimension columns dynamically.
        col_names = [r[0] for r in con.execute("DESCRIBE priors").fetchall()]
        dim_cols = [c for c in col_names if c not in ("question_id", "question_label", "answer_label", "prob")]
        where_clauses = " AND ".join(f"{c} = 'ALL'" for c in dim_cols)
        sql = f"SELECT answer_label, prob FROM priors WHERE question_id = ? AND {where_clauses} ORDER BY prob DESC"
        rows = con.execute(sql, [question_id]).fetchall()
        if not rows:
            logger.warning("No national marginal found for %s via duckdb", question_id)
            return None
        return [{"answer_label": a, "prob": float(p)} for a, p in rows]
    except ImportError:
        pass

    logger.warning(
        "Could not load national prior for %s: install pandas or duckdb in this environment.",
        question_id,
    )
    return None


def evaluate_sim_id(sim_id: str) -> Optional[SimulationEval]:
    """Load a saved simulation and evaluate it end-to-end."""
    sim_data = load_simulation(sim_id)
    if sim_data is None:
        logger.error("Simulation %s not found.", sim_id)
        return None

    question_id = sim_data.get("question_id", "")
    national_prior = load_national_prior(question_id) if question_id else None

    return evaluate_simulation(sim_data, national_prior=national_prior)
