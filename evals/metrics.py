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


def wasserstein_distance(p: dict[str, float], q: dict[str, float]) -> float:
    """Normalized 1-Wasserstein distance (Earth Mover's Distance / NEMD) between
    two discrete distributions over ordered opinion categories.

    Categories are ranked by descending probability under *p* (the reference
    distribution — typically the ATP national prior), which imposes an ordinal
    ordering appropriate for Likert-style opinion questions.  The distance is
    then normalized by K-1 (K = number of categories) so the result lies in
    [0, 1] regardless of the number of answer options.  This is the Normalized
    Earth Mover's Distance (NEMD) formulation.

    Advantage over Hellinger / TVD
    --------------------------------
    TVD and Hellinger treat all categories as exchangeable; they ignore the
    "nearness" of adjacent Likert positions.  Wasserstein distance accounts for
    the ordered structure: moving probability mass one step costs less than
    moving it across the full scale, making it a more sensitive and semantically
    meaningful measure of distributional alignment on ordinal survey data.

    Key references
    --------------
    * Suh, Jahanparast, Moon, Kang & Chang (ACL 2025).  "Language Model
      Fine-Tuning on Scaled Survey Data for Predicting Distributions of
      Public Opinions."  https://aclanthology.org/2025.acl-long.1028/
      Uses WD to measure LLM–human alignment on public opinion survey
      distributions (including Pew ATP-style data); demonstrates it is more
      sensitive to near-miss distributional errors than TVD.
    * Gong, Sanders & Schneier (arXiv 2026, 2603.20229).  "Characterizing the
      ability of LLMs to recapitulate Americans' distributional responses to
      public opinion polling questions across political issues."
      Adopts NEMD (W1 / (K-1)) specifically for ordinal ATP-style survey
      comparison of LLM simulation against human poll results.
    * Lee & Sobel (arXiv 2024, 2408.03331).  "The Wasserstein Bipolarization
      Index: A New Measure of Public Opinion Polarization."
      Formally justifies W1 over Hellinger/TVD for ordinal opinion data:
      the Wasserstein metric respects the linear order of response categories
      and is interpretable as the cost of redistributing probability mass along
      the opinion scale.
    * Jiang, Huang, Ge et al. (2026).  "Simulating social perception with
      large language models."  J. Chinese Governance.  Uses WD to compare
      LLM-predicted vs. empirical survey distributions in social simulation.
    """
    all_keys = sorted(set(p) | set(q), key=lambda k: -p.get(k, 0.0))
    k = len(all_keys)
    if k <= 1:
        return 0.0
    p_arr = [p.get(lbl, 0.0) for lbl in all_keys]
    q_arr = [q.get(lbl, 0.0) for lbl in all_keys]
    # CDF formula: W1 = sum |CDF_P(i) - CDF_Q(i)| for i = 1 .. K-1
    cdf_p = cdf_q = 0.0
    w1 = 0.0
    for i in range(k - 1):
        cdf_p += p_arr[i]
        cdf_q += q_arr[i]
        w1 += abs(cdf_p - cdf_q)
    # Normalise by K-1 → NEMD ∈ [0, 1]
    return w1 / (k - 1)


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


def wilson_ci(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """Wilson score confidence interval for a binomial proportion.

    k: number of successes (agents who chose this answer)
    n: total trials (total agents)
    confidence: e.g. 0.95 for a 95% CI

    Returns (lower, upper) in [0, 1].
    Handles n=0 by returning (0.0, 1.0).
    """
    if n == 0:
        return (0.0, 1.0)
    # z for two-sided interval
    z = {0.90: 1.6449, 0.95: 1.9600, 0.99: 2.5758}.get(confidence, 1.9600)
    p_hat = k / n
    z2 = z * z
    centre = (p_hat + z2 / (2 * n)) / (1 + z2 / n)
    margin = (z / (1 + z2 / n)) * math.sqrt(p_hat * (1 - p_hat) / n + z2 / (4 * n * n))
    return (max(0.0, centre - margin), min(1.0, centre + margin))


def answer_cis(
    simulated: dict[str, float],
    n: int,
    confidence: float = 0.95,
) -> dict[str, tuple[float, float]]:
    """Wilson CIs for every answer option given the simulated distribution and n agents.

    simulated: {answer_label: proportion}  (sums to 1)
    n: total number of agents
    Returns {answer_label: (lower, upper)}
    """
    return {
        label: wilson_ci(round(prop * n), n, confidence)
        for label, prop in simulated.items()
    }


def prior_in_ci_rate(
    national_prior: dict[str, float],
    cis: dict[str, tuple[float, float]],
) -> float:
    """Fraction of answer options whose ATP prior probability falls within its CI.

    1.0 = all ATP priors are statistically consistent with the simulation.
    0.0 = no ATP priors fall within the simulated CIs.
    """
    if not national_prior or not cis:
        return float("nan")
    hits = sum(
        1 for label, atp_p in national_prior.items()
        if label in cis and cis[label][0] <= atp_p <= cis[label][1]
    )
    return hits / len(national_prior)
