"""
Pure-math metric functions for evaluating CivicSim agent opinion accuracy.

All functions operate on plain Python dicts/lists — no backend dependencies.
"""

from __future__ import annotations

import math


def total_variation_distance(p: dict[str, float], q: dict[str, float]) -> float:
    """Half the L1 norm between two distributions over the same support.

    Missing keys are treated as probability 0. Returns a value in [0, 1].
    TVD = 0 means identical; TVD = 1 means completely disjoint support.
    """
    all_keys = set(p) | set(q)
    return 0.5 * sum(abs(p.get(k, 0.0) - q.get(k, 0.0)) for k in all_keys)


def kl_divergence(p: dict[str, float], q: dict[str, float], eps: float = 1e-9) -> float:
    """KL(p || q) where p is the reference ("true") distribution.

    Uses eps-smoothing on q to avoid log(0). Returns nats.
    Low KL means q is a good approximation of p.
    """
    total = 0.0
    for k in set(p) | set(q):
        pk = p.get(k, 0.0)
        qk = q.get(k, 0.0) + eps
        if pk > 0:
            total += pk * math.log(pk / qk)
    return total


def hellinger_distance(p: dict[str, float], q: dict[str, float]) -> float:
    """Hellinger distance in [0, 1].

    Unlike KL, this is symmetric and bounded — useful for reporting.
    """
    all_keys = set(p) | set(q)
    sq_sum = sum(
        (math.sqrt(p.get(k, 0.0)) - math.sqrt(q.get(k, 0.0))) ** 2
        for k in all_keys
    )
    return math.sqrt(sq_sum / 2.0)


def prior_prob_of_stance(stance: str, prior: list[dict]) -> float:
    """Return the probability the prior assigns to the given stance.

    prior: list of {"answer_label": str, "prob": float}.
    Returns 0.0 if the stance is not in the prior.
    """
    for item in prior:
        if item["answer_label"] == stance:
            return float(item["prob"])
    return 0.0


def prior_rank_of_stance(stance: str, prior: list[dict]) -> int:
    """1-indexed rank of stance in the prior (rank 1 = modal answer).

    Returns len(prior) + 1 if the stance is not found in the prior.
    """
    ranked = sorted(prior, key=lambda x: x["prob"], reverse=True)
    for i, item in enumerate(ranked, start=1):
        if item["answer_label"] == stance:
            return i
    return len(prior) + 1


def modal_answer(prior: list[dict]) -> str | None:
    """Return the most probable answer label according to the prior."""
    if not prior:
        return None
    return max(prior, key=lambda x: x["prob"])["answer_label"]


def stances_to_distribution(stances: list[str], answer_options: list[str]) -> dict[str, float]:
    """Convert a list of stance strings into a normalized probability distribution.

    Stances not in answer_options are silently ignored.
    """
    counts: dict[str, int] = {opt: 0 for opt in answer_options}
    for s in stances:
        if s in counts:
            counts[s] += 1
    total = sum(counts.values())
    if total == 0:
        n = len(answer_options)
        return {opt: 1.0 / n for opt in answer_options}
    return {opt: counts[opt] / total for opt in answer_options}


def expected_log_likelihood(agent_records: list[dict]) -> float:
    """Mean log P(stance | prior) across agents — a per-agent calibration score.

    Higher (closer to 0) is better; very negative means the LLM often chose
    answers the prior considered unlikely.

    agent_records: list of dicts with keys "stance" (str) and "prior" (list[dict]).
    """
    log_probs = []
    for rec in agent_records:
        p = prior_prob_of_stance(rec["stance"], rec["prior"])
        log_probs.append(math.log(max(p, 1e-9)))
    if not log_probs:
        return float("-inf")
    return sum(log_probs) / len(log_probs)


def prior_as_dict(prior: list[dict]) -> dict[str, float]:
    """Convert list[{"answer_label", "prob"}] to {label: prob}."""
    return {item["answer_label"]: float(item["prob"]) for item in prior}
