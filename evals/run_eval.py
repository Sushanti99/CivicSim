#!/usr/bin/env python3
"""
CLI to evaluate CivicSim agent opinion accuracy and trustworthiness.

Usage examples:

    # Evaluate a single saved simulation
    python evals/run_eval.py --sim-id 003__region_west__environment_climate__20260513_023827

    # Evaluate all saved simulations (table summary)
    python evals/run_eval.py --all

    # Evaluate all, output JSON
    python evals/run_eval.py --all --format json

    # Evaluate a specific sim with per-agent detail
    python evals/run_eval.py --sim-id 001__... --detail

    # Evaluate the N most recent simulations
    python evals/run_eval.py --recent 5

Metrics reported:
  validity_rate        All agents chose a valid answer option (should be 1.0).
  mean_prior_prob      Avg P(stance | demographics) per ATP — higher = more aligned.
  modal_agreement_rate Fraction of agents who chose the most likely answer for their cell.
  top2_rate            Fraction of agents whose stance ranked top-2 in their prior.
  expected_log_lik     Mean log P(stance | prior). Closer to 0 = better calibration.
  tvd_vs_national      Total Variation Distance vs. real ATP population distribution.
  kl_vs_national       KL(national || simulated). 0 = perfect match.
  hellinger_vs_national Hellinger distance (bounded [0, 1]).
  answer_coverage      Fraction of answer options chosen by at least one agent.
  trust_score          Composite [0, 100] trustworthiness score.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Make the backend and repo root importable.
_REPO_ROOT = Path(__file__).resolve().parents[1]
_BACKEND = _REPO_ROOT / "backend"
for _p in [str(_REPO_ROOT), str(_BACKEND)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

os.environ.setdefault("ATP_PRIORS_PATH", str(_REPO_ROOT / "data" / "atp_priors" / "policy_priors.parquet"))
os.environ.setdefault("LLM_PROVIDER", "mock")

from evals.evaluator import (  # noqa: E402
    SimulationEval,
    evaluate_sim_id,
    load_all_sim_ids,
)

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------

_TRUST_THRESHOLDS = [
    (80, "EXCELLENT"),
    (65, "GOOD"),
    (50, "FAIR"),
    (35, "POOR"),
    (0,  "LOW"),
]

_METRIC_GUIDANCE = {
    "validity_rate":        ("== 1.00",  "All stances must be valid answer options."),
    "mean_prior_prob":      (">  0.30",  "Avg prior prob; low = LLM often chose unlikely answers."),
    "modal_agreement_rate": (">  0.35",  "Fraction choosing modal answer for their demographic."),
    "top2_rate":            (">  0.60",  "Fraction whose stance ranked top-2 in their prior."),
    "tvd_vs_national":      ("<  0.15",  "TVD vs. real ATP polling; 0 = perfect match."),
    "hellinger_vs_national":("<  0.15",  "Hellinger distance (bounded); 0 = identical."),
    "answer_coverage":      (">  0.80",  "Fraction of answer options actually chosen."),
}


def _trust_label(score: float) -> str:
    for threshold, label in _TRUST_THRESHOLDS:
        if score >= threshold:
            return label
    return "LOW"


def _flag(metric: str, value: float) -> str:
    """Return a pass/warn/fail indicator for a metric value."""
    rules: dict[str, tuple[str, float]] = {
        "validity_rate":         (">=", 1.00),
        "mean_prior_prob":       (">=", 0.30),
        "modal_agreement_rate":  (">=", 0.35),
        "top2_rate":             (">=", 0.60),
        "tvd_vs_national":       ("<=", 0.15),
        "hellinger_vs_national": ("<=", 0.15),
        "answer_coverage":       (">=", 0.80),
    }
    if metric not in rules:
        return ""
    op, threshold = rules[metric]
    if op == ">=" and value >= threshold:
        return "[OK]"
    if op == "<=" and value <= threshold:
        return "[OK]"
    if op == ">=" and value >= threshold * 0.75:
        return "[WARN]"
    if op == "<=" and value <= threshold * 1.5:
        return "[WARN]"
    return "[FAIL]"


def _fmt(value: float, decimals: int = 4) -> str:
    if value != value:  # NaN check
        return "  N/A   "
    if value == float("inf") or value == float("-inf"):
        return "  inf   "
    return f"{value:.{decimals}f}"


def print_summary_table(evals: list[SimulationEval]) -> None:
    """Print a compact table: one row per simulation."""
    cols = [
        ("sim_id",      30),
        ("Q",           16),
        ("N",            4),
        ("valid",        6),
        ("prior_p",      7),
        ("modal%",       7),
        ("top2%",        6),
        ("TVD",          6),
        ("cover",        6),
        ("score",        7),
        ("grade",        10),
    ]
    header = "  ".join(name.ljust(w) for name, w in cols)
    print(header)
    print("-" * len(header))

    for ev in evals:
        s = ev.aggregate_summary()
        row = [
            ev.sim_id[:30].ljust(30),
            ev.question_id[:16].ljust(16),
            str(ev.n_agents).rjust(4),
            _fmt(s["validity_rate"], 2).rjust(6),
            _fmt(s["mean_prior_prob"], 3).rjust(7),
            _fmt(s["modal_agreement_rate"], 3).rjust(7),
            _fmt(s["top2_rate"], 3).rjust(6),
            _fmt(s["tvd_vs_national"], 3).rjust(6),
            _fmt(s["answer_coverage"], 2).rjust(6),
            _fmt(s["trust_score"], 1).rjust(7),
            _trust_label(s["trust_score"]).ljust(10),
        ]
        print("  ".join(row))


def print_detail_report(ev: SimulationEval) -> None:
    """Print a verbose single-simulation report."""
    s = ev.aggregate_summary()
    sep = "=" * 72

    print(sep)
    print(f"Simulation: {ev.sim_id}")
    print(f"Question  : {ev.question_label}")
    print(f"Location  : {ev.location}")
    print(f"N agents  : {ev.n_agents}")
    print(sep)

    print("\n--- Aggregate Metrics ---")
    metric_rows = [
        ("validity_rate",         s["validity_rate"]),
        ("mean_prior_prob",       s["mean_prior_prob"]),
        ("modal_agreement_rate",  s["modal_agreement_rate"]),
        ("top2_rate",             s["top2_rate"]),
        ("expected_log_lik",      s["expected_log_likelihood"]),
        ("tvd_vs_national",       s["tvd_vs_national"]),
        ("kl_vs_national",        s["kl_vs_national"]),
        ("hellinger_vs_national", s["hellinger_vs_national"]),
        ("answer_coverage",       s["answer_coverage"]),
    ]
    for name, val in metric_rows:
        guidance = _METRIC_GUIDANCE.get(name, ("", ""))
        flag = _flag(name, val) if not isinstance(val, str) else ""
        print(f"  {name:<26} {_fmt(val, 4):<10} {flag:<8} {guidance[0]:<10} {guidance[1]}")

    print(f"\n  Trust Score: {s['trust_score']:.1f} / 100  [{_trust_label(s['trust_score'])}]")

    # ---- National prior vs. simulated distribution ----
    if ev.national_prior:
        print("\n--- Answer Distribution ---")
        all_answers = sorted(set(ev.national_prior) | set(ev.simulated_aggregate))
        print(f"  {'Answer':<40} {'ATP Prior':>10} {'Simulated':>10} {'Δ':>8}")
        print("  " + "-" * 70)
        for ans in all_answers:
            atp_p = ev.national_prior.get(ans, 0.0)
            sim_p = ev.simulated_aggregate.get(ans, 0.0)
            delta = sim_p - atp_p
            print(f"  {ans[:40]:<40} {atp_p:>10.3f} {sim_p:>10.3f} {delta:>+8.3f}")

    # ---- Demographic breakdown ----
    if ev.demographic_evals:
        print("\n--- Demographic Group Breakdown (TVD vs. group prior) ---")
        print(f"  {'dim':<16} {'value':<30} {'N':>4} {'TVD':>8} {'Hellinger':>10}")
        print("  " + "-" * 72)
        for de in sorted(ev.demographic_evals, key=lambda x: -x.tvd):
            print(
                f"  {de.dim:<16} {de.value[:30]:<30} {de.n_agents:>4} "
                f"{de.tvd:>8.4f} {de.hellinger:>10.4f}"
            )

    # ---- Per-agent detail ----
    print("\n--- Per-Agent Results ---")
    print(f"  {'ID':>4} {'Stance':<35} {'P(stance)':>9} {'Rank':>5} {'Modal?':>7} {'Backoff'}  ")
    print("  " + "-" * 80)
    for ae in ev.agent_evals:
        backoff_str = ", ".join(ae.backoff_steps[:3]) if ae.backoff_steps else "none"
        print(
            f"  {ae.agent_id:>4} {ae.stance[:35]:<35} {ae.prior_prob:>9.4f} "
            f"{ae.prior_rank:>5} {'Yes' if ae.modal_agreement else 'No':>7} "
            f"  {backoff_str}"
        )

    print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    target = p.add_mutually_exclusive_group(required=True)
    target.add_argument("--sim-id", nargs="+", metavar="ID",
                        help="One or more simulation IDs to evaluate.")
    target.add_argument("--all", action="store_true",
                        help="Evaluate all saved simulations.")
    target.add_argument("--recent", type=int, metavar="N",
                        help="Evaluate the N most-recently-written simulations.")

    p.add_argument("--format", choices=["table", "json"], default="table",
                   help="Output format (default: table).")
    p.add_argument("--detail", action="store_true",
                   help="Print a verbose per-simulation report (table format only).")
    p.add_argument("--question", metavar="QID",
                   help="Only evaluate simulations for this question_id.")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    # Collect sim IDs.
    if args.sim_id:
        sim_ids = args.sim_id
    else:
        all_ids = load_all_sim_ids()
        if args.recent:
            sim_ids = all_ids[: args.recent]
        else:
            sim_ids = all_ids

    if not sim_ids:
        print("No simulations found.", file=sys.stderr)
        return 1

    evals: list[SimulationEval] = []
    for sid in sim_ids:
        ev = evaluate_sim_id(sid)
        if ev is None:
            print(f"Warning: could not load {sid}", file=sys.stderr)
            continue
        if args.question and ev.question_id != args.question:
            continue
        evals.append(ev)

    if not evals:
        print("No evaluations produced.", file=sys.stderr)
        return 1

    if args.format == "json":
        output = []
        for ev in evals:
            record = ev.aggregate_summary()
            record["agent_evals"] = [a.summary() for a in ev.agent_evals]
            record["demographic_evals"] = [
                {
                    "dim": de.dim,
                    "value": de.value,
                    "n_agents": de.n_agents,
                    "tvd": round(de.tvd, 4),
                    "hellinger": round(de.hellinger, 4),
                }
                for de in ev.demographic_evals
            ]
            output.append(record)
        print(json.dumps(output, indent=2))
    else:
        if args.detail:
            for ev in evals:
                print_detail_report(ev)
        else:
            print_summary_table(evals)
            # Print trust-score legend.
            print()
            print("Grade: EXCELLENT≥80  GOOD≥65  FAIR≥50  POOR≥35  LOW<35")
            print("TVD: Total Variation Distance vs. ATP national prior (lower = better)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
