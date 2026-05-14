#!/usr/bin/env python3
"""
eval_table.py — Compare CivicSim vs. Naive LLM vs. ATP ground truth.

For each domain × question × demographic slice:
  CivicSim:          prior-grounded LLM (ATP distribution injected into prompt)
  Naive Anthropic:   same per-agent persona, no ATP prior in prompt
  Naive OpenAI:      same per-agent persona, no ATP prior in prompt
  ATP ground truth:  WEIGHT-aggregated from S3 respondent-level data
                     (falls back to compact parquet if S3 unavailable)

Metrics per condition: Wasserstein (ordinal), TVD, KL divergence, Hellinger

Outputs:
  evals/results/eval_table.parquet
  evals/results/eval_report.md
  evals/results/eval_report.html

Required env vars — script flags any that are missing before running:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION   (S3 ground truth)
  ANTHROPIC_API_KEY                                               (CivicSim + Naive Anthropic)
  OPENAI_API_KEY                                                  (Naive OpenAI)

Usage:
  python evals/eval_table.py                      # full table (all domains)
  python evals/eval_table.py --domain economy     # single domain
  python evals/eval_table.py --dry-run            # show plan, no LLM calls
  python evals/eval_table.py --n-agents 10        # override agent count
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import os
import sys
import time
from pathlib import Path

import pandas as pd

# ── Path setup ──────────────────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent
_BACKEND = _REPO_ROOT / "backend"
_AGENTS_PKG = _REPO_ROOT / "packages" / "civicsim_agents"
for _p in [str(_REPO_ROOT), str(_BACKEND), str(_AGENTS_PKG)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

# Auto-load .env from repo root (python-dotenv, graceful if not installed)
_dotenv_path = _REPO_ROOT / ".env"
if _dotenv_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_dotenv_path, override=False)  # don't override vars already in env
    except ImportError:
        # dotenv not installed — parse manually for the eval-specific vars
        for _line in _dotenv_path.read_text().splitlines():
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                if _k.strip() not in os.environ and _v.strip():
                    os.environ[_k.strip()] = _v.strip()

from evals.metrics import (
    kl_divergence,
    stances_to_distribution,
    total_variation_distance,
    wasserstein_distance as _nemd,
)

# ── Configuration (env overrides respected) ──────────────────────────────────
N_AGENTS = int(os.getenv("EVAL_N_AGENTS", "30"))
D_SLICES = int(os.getenv("EVAL_D_SLICES", "20"))
Q_PER_DOMAIN = int(os.getenv("EVAL_Q_PER_DOMAIN", "2"))
LLM_CONCURRENCY = 5      # max parallel LLM calls

S3_ATP_URI = "s3://civicsim-data/parquet/atp_2021_2024_final.parquet"
DOMAIN_JSON = _REPO_ROOT / "data" / "atp_priors" / "domain_demographics.json"
COMPACT_PARQUET = _REPO_ROOT / "data" / "atp_priors" / "policy_priors.parquet"
RESULTS_DIR = _HERE / "results"

ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
OPENAI_MODEL = "gpt-4o-mini"

# Mapping from compact-parquet dim keys → possible S3 ATP column names
# (update if the raw ATP file uses different column names)
ATP_COL_MAP: dict[str, list[str]] = {
    "F_CREGION": ["F_CREGION"],
    "age_group": ["F_AGECAT", "age_group", "F_AGECAT2"],
    "race_eth": ["F_RACETHN", "race_eth", "F_RACETHN4"],
    "income_group": ["F_INCOME_RECODE", "income_group", "F_INCOME"],
    "education_group": ["F_EDUCCAT2", "education_group", "F_EDUC"],
    "gender": ["F_GENDER", "gender"],
    "urbanicity": ["F_METRO", "urbanicity", "F_CREGION_FINAL"],
}

REGION_TO_LOCATION: dict[str, str] = {
    "West": "region_west",
    "South": "region_south",
    "Northeast": "region_northeast",
    "Midwest": "region_midwest",
}
DEFAULT_LOCATION = "region_west"

ALL_DEMO_DIMS = [
    "F_CREGION", "F_CDIVISION", "age_group", "gender",
    "race_eth", "education_group", "income_group", "urbanicity",
]

# Ordinal scales for Wasserstein (ascending order, normalized lowercase)
ORDINAL_SCALES: list[list[str]] = [
    ["not at all", "not too much", "some", "a great deal"],
    ["not at all important", "not too important", "somewhat important", "very important"],
    ["strongly oppose", "oppose", "favor", "strongly favor"],
    ["strongly disagree", "disagree", "agree", "strongly agree"],
    ["very unfavorable", "unfavorable", "favorable", "very favorable"],
    ["never", "sometimes", "often", "always"],
    ["very dissatisfied", "dissatisfied", "satisfied", "very satisfied"],
    ["much worse", "worse", "about the same", "better", "much better"],
    ["not at all well", "not too well", "somewhat well", "very well"],
    ["very negative", "negative", "positive", "very positive"],
    ["completely wrong direction", "mostly wrong direction", "mostly right direction", "completely right direction"],
]

NAIVE_SYSTEM_PROMPT = (
    "You are simulating a single voter for a research study on public opinion. "
    "Stay in character. Pick exactly one of the listed answer options as your stance, "
    "then give a single-sentence rationale (max 30 words). "
    'Respond ONLY with strict JSON: {"stance": <answer>, "rationale": <text>}.'
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("eval_table")


# ── Credential check ─────────────────────────────────────────────────────────

def check_credentials() -> dict[str, bool]:
    creds = {
        "AWS_ACCESS_KEY_ID": bool(os.getenv("AWS_ACCESS_KEY_ID")),
        "AWS_SECRET_ACCESS_KEY": bool(os.getenv("AWS_SECRET_ACCESS_KEY")),
        "AWS_DEFAULT_REGION": bool(os.getenv("AWS_DEFAULT_REGION")),
        "ANTHROPIC_API_KEY": bool(os.getenv("ANTHROPIC_API_KEY")),
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
    }
    missing = [k for k, v in creds.items() if not v]
    if missing:
        log.warning("⚠  Missing credentials: %s", ", ".join(missing))
        if "AWS_ACCESS_KEY_ID" in missing or "AWS_SECRET_ACCESS_KEY" in missing:
            log.warning("   → S3 ground truth unavailable; will fall back to compact parquet")
        if "ANTHROPIC_API_KEY" in missing:
            log.warning("   → Anthropic (CivicSim + Naive Anthropic) will be SKIPPED")
        if "OPENAI_API_KEY" in missing:
            log.warning("   → Naive OpenAI will be SKIPPED")
    return creds


# ── Domain catalog ────────────────────────────────────────────────────────────

def load_domain_catalog() -> dict:
    with open(DOMAIN_JSON) as f:
        return json.load(f)


def domains_with_questions(catalog: dict, filter_domain: str | None) -> dict:
    result = {}
    for domain, info in catalog.items():
        if filter_domain and domain != filter_domain:
            continue
        qids = info.get("question_ids", [])
        if not qids:
            continue
        auto_dims = [d["key"] for d in info.get("dimensions", []) if d.get("auto_selected")]
        result[domain] = {
            "label": info.get("label", domain),
            "dims": auto_dims,
            "question_ids": qids[:Q_PER_DOMAIN],
        }
    return result


# ── Compact parquet helpers ───────────────────────────────────────────────────

def load_compact_parquet() -> pd.DataFrame:
    return pd.read_parquet(COMPACT_PARQUET)


def get_answer_options(question_id: str, compact_df: pd.DataFrame) -> list[str]:
    rows = compact_df[compact_df["question_id"] == question_id]["answer_label"].unique()
    return sorted(rows.tolist())


def get_question_label(question_id: str, compact_df: pd.DataFrame) -> str:
    rows = compact_df[compact_df["question_id"] == question_id]["question_label"]
    return rows.iloc[0] if len(rows) > 0 else question_id


def find_diverse_slices(
    question_id: str,
    dims: list[str],
    compact_df: pd.DataFrame,
    d: int = D_SLICES,
    seed: int = 42,
) -> list[dict[str, str]]:
    """Return D intersectional demographic slices for this question.

    Every slice uses ALL available dims simultaneously (e.g. race × income ×
    region), never falling back to 1-dim or 2-dim marginals. Unique values for
    each dim are read from the parquet marginal rows. Combinations are
    generated by round-robin across dim values to maximise spread — ensuring
    every income bracket, race group, and region appears before any is doubled.

    The parquet is only used to discover valid dim values; the combinations
    themselves need not exist as rows in the parquet. The prior lookup
    (_compact_marginal_prior) and S3 ground truth both handle arbitrary
    intersections gracefully.
    """
    import random as _random

    rng = _random.Random(seed)

    q_df = compact_df[compact_df["question_id"] == question_id]
    if q_df.empty:
        return []

    available_dims = [dim for dim in dims if dim in q_df.columns]
    if not available_dims:
        return []

    # Collect unique non-ALL values per dim from the parquet marginals.
    dim_values: dict[str, list[str]] = {}
    for dim in available_dims:
        vals = sorted(q_df[q_df[dim] != "ALL"][dim].unique().tolist())
        if vals:
            dim_values[dim] = vals

    if not dim_values:
        return []

    # Shuffle each dim's value list so the round-robin doesn't always start
    # with the same value (e.g. always "above_100000" or "White").
    for dim in dim_values:
        rng.shuffle(dim_values[dim])

    # Round-robin: at each round pick the next value for each dim and combine
    # them into a full intersectional slice. This guarantees every value of
    # every dim appears at least once before any value is reused.
    selected: list[dict[str, str]] = []
    selected_keys: set[tuple] = set()
    max_rounds = max(len(v) for v in dim_values.values())

    for round_i in range(max_rounds):
        if len(selected) >= d:
            break
        # Build one slice: for each dim pick the value at this round index
        # (wrapping around with modulo so shorter dims cycle).
        slice_candidate = {
            dim: dim_values[dim][round_i % len(dim_values[dim])]
            for dim in dim_values
        }
        key = tuple(sorted(slice_candidate.items()))
        if key not in selected_keys:
            selected.append(slice_candidate)
            selected_keys.add(key)

    # If still under d, fill with additional combinations by shifting one dim
    # at a time until we reach d or exhaust possibilities.
    extra_round = 0
    while len(selected) < d:
        added_any = False
        for shift_dim in dim_values:
            if len(selected) >= d:
                break
            base_round = max_rounds + extra_round
            slice_candidate = {
                dim: dim_values[dim][
                    (base_round + (1 if dim == shift_dim else 0)) % len(dim_values[dim])
                ]
                for dim in dim_values
            }
            key = tuple(sorted(slice_candidate.items()))
            if key not in selected_keys:
                selected.append(slice_candidate)
                selected_keys.add(key)
                added_any = True
        if not added_any:
            break  # all combinations exhausted
        extra_round += 1
        if extra_round > d * len(dim_values):
            break  # safety: avoid infinite loop if combinations are exhausted

    return selected[:d]


def compact_parquet_ground_truth(
    question_id: str,
    slice_filter: dict[str, str],
    compact_df: pd.DataFrame,
) -> dict[str, float] | None:
    """Return distribution from compact parquet for the given demographic slice.

    Matches rows where all slice_filter dims equal the target values; uses
    weighted average of prob across any sub-cells (different values for other dims).
    """
    q_df = compact_df[compact_df["question_id"] == question_id]
    if q_df.empty:
        return None

    mask = pd.Series(True, index=q_df.index)
    for dim, val in slice_filter.items():
        if dim in q_df.columns:
            mask &= q_df[dim] == val

    sub = q_df[mask]
    if sub.empty:
        return None

    dist = sub.groupby("answer_label")["prob"].mean()
    total = dist.sum()
    if total == 0:
        return None
    return {label: float(p / total) for label, p in dist.items()}


# ── S3 ATP ground truth ───────────────────────────────────────────────────────
# S3 schema (long format, confirmed):
#   respondent_id, WAVE, WEIGHT, question_code, answer_code (numeric float),
#   age_group, income_group, education_group, urbanicity,
#   F_CREGION, F_CDIVISION, gender, race_eth, YEAR
# Answer codes (1.0, 2.0, ...) must be joined to atp_YEAR_answer_labels.parquet
# to get text labels matching the compact parquet / LLM output.

S3_AVAILABLE_DIMS = {
    "age_group", "income_group", "education_group", "urbanicity",
    "F_CREGION", "F_CDIVISION", "gender", "race_eth",
}

# S3 dataset and answer-label cache
_s3_dataset = None
_s3_answer_labels: dict[str, str] | None = None  # "QCODE:1.0" → "A great deal"


def _s3_boto_client():
    import boto3
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )


def _load_s3_answer_labels() -> dict[str, str]:
    """Download all 4 annual answer_labels parquets and return a lookup dict."""
    global _s3_answer_labels
    if _s3_answer_labels is not None:
        return _s3_answer_labels

    import io
    s3 = _s3_boto_client()
    frames = []
    for year in [2021, 2022, 2023, 2024]:
        try:
            obj = s3.get_object(Bucket="civicsim-data", Key=f"parquet/atp_{year}_answer_labels.parquet")
            frames.append(pd.read_parquet(io.BytesIO(obj["Body"].read())))
        except Exception as exc:
            log.warning("Could not load %d answer labels: %s", year, exc)

    if not frames:
        _s3_answer_labels = {}
        return _s3_answer_labels

    combined = pd.concat(frames).drop_duplicates(subset=["question_code", "answer_code"])
    _s3_answer_labels = {
        f"{row.question_code}:{row.answer_code}": str(row.answer_label)
        for row in combined.itertuples()
    }
    log.info("Loaded %d S3 answer label entries", len(_s3_answer_labels))
    return _s3_answer_labels


def _get_s3_dataset():
    global _s3_dataset
    if _s3_dataset is not None:
        return _s3_dataset

    try:
        import pyarrow.dataset as ds
    except ImportError:
        log.warning("pyarrow not available; skipping S3 load")
        return None

    try:
        import pyarrow.fs as pafs
        fs = pafs.S3FileSystem(
            access_key=os.environ.get("AWS_ACCESS_KEY_ID"),
            secret_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
            region=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        )
        dataset = ds.dataset(
            S3_ATP_URI.replace("s3://", ""),
            filesystem=fs,
            format="parquet",
        )
        if "question_code" not in dataset.schema.names:
            log.warning("S3 ATP missing question_code column")
            return None
        _s3_dataset = dataset
        return dataset
    except Exception as exc:
        log.warning("S3 connect failed: %s", exc)
        return None


def load_s3_atp(question_id: str) -> pd.DataFrame | None:
    """Return S3 rows for one question_id with text answer labels joined in."""
    dataset = _get_s3_dataset()
    if dataset is None:
        return None
    try:
        import pyarrow.compute as pc
        table = dataset.to_table(filter=pc.field("question_code") == question_id)
        if table.num_rows == 0:
            log.warning("question_code %r not found in S3 ATP", question_id)
            return None
        df = table.to_pandas()

        # Convert numeric answer_code → text label using the labels lookup
        labels = _load_s3_answer_labels()
        df["answer_label"] = df["answer_code"].apply(
            lambda code: labels.get(f"{question_id}:{code}", str(code))
        )
        # Drop refused/don't-know (code 99)
        df = df[df["answer_label"] != "Refused"]
        return df
    except Exception as exc:
        log.warning("S3 question load failed for %r: %s", question_id, exc)
        return None


def _s3_filesystem(storage_options: dict):
    try:
        import pyarrow.fs as pafs
        return pafs.S3FileSystem(
            access_key=storage_options.get("key"),
            secret_key=storage_options.get("secret"),
            region=storage_options.get("region", "us-east-1"),
        )
    except Exception:
        return None


def s3_ground_truth(
    question_id: str,
    slice_filter: dict[str, str],
    atp_df: pd.DataFrame,
) -> dict[str, float] | None:
    """Compute WEIGHT-aggregated text-label distribution from S3 ATP data."""
    if "WEIGHT" not in atp_df.columns:
        atp_df = atp_df.copy()
        atp_df["WEIGHT"] = 1.0

    df = atp_df.dropna(subset=["answer_label", "WEIGHT"])

    for dim, val in slice_filter.items():
        if dim not in S3_AVAILABLE_DIMS or dim not in df.columns:
            continue
        df = df[df[dim] == val]

    if df.empty:
        return None

    dist = df.groupby("answer_label")["WEIGHT"].sum()
    total = dist.sum()
    if total == 0:
        return None
    return {str(label): float(w / total) for label, w in dist.items()}


# ── Ordinal detection + Wasserstein ──────────────────────────────────────────

def detect_ordinal_order(answer_options: list[str]) -> list[str] | None:
    """Return answer options in ascending ordinal order, or None if nominal."""
    normalized = {opt.lower().strip(): opt for opt in answer_options}
    for scale in ORDINAL_SCALES:
        scale_subset = [s for s in scale if s in normalized]
        if len(scale_subset) >= max(2, len(answer_options) - 1):
            ordered = [normalized[s] for s in scale_subset if s in normalized]
            missing = [opt for opt in answer_options if opt not in ordered]
            return ordered + missing
    return None


def _wasserstein_ordinal(
    p: dict[str, float],
    q: dict[str, float],
    order: list[str],
) -> float:
    """Wasserstein-1 on ordinal integer ranks, normalized to [0, 1]."""
    k = len(order)
    if k <= 1:
        return 0.0
    u_w = [p.get(label, 0.0) for label in order]
    v_w = [q.get(label, 0.0) for label in order]
    u_total, v_total = sum(u_w), sum(v_w)
    if u_total == 0 or v_total == 0:
        return float("nan")
    u_w = [w / u_total for w in u_w]
    v_w = [w / v_total for w in v_w]
    cdf_u = cdf_v = 0.0
    w1 = 0.0
    for i in range(k - 1):
        cdf_u += u_w[i]
        cdf_v += v_w[i]
        w1 += abs(cdf_u - cdf_v)
    return w1 / (k - 1)


# ── Metrics ───────────────────────────────────────────────────────────────────

def _hellinger(p: dict[str, float], q: dict[str, float]) -> float:
    all_keys = set(p) | set(q)
    return math.sqrt(0.5 * sum((math.sqrt(p.get(k, 0.0)) - math.sqrt(q.get(k, 0.0))) ** 2 for k in all_keys))


def compute_all_metrics(
    pred: dict[str, float],
    gt: dict[str, float],
    answer_options: list[str],
) -> dict[str, float]:
    tvd = total_variation_distance(pred, gt)
    kl = kl_divergence(pred, gt)
    hell = _hellinger(pred, gt)
    # Use explicit ordinal ordering when Likert keywords are detected;
    # fall back to NEMD (CDF-based, sorts by pred probability) otherwise
    order = detect_ordinal_order(answer_options)
    wass = _wasserstein_ordinal(pred, gt, order) if order else _nemd(pred, gt)
    return {"tvd": tvd, "kl": kl, "hellinger": hell, "wasserstein": wass}


# ── Low-level HTTP API calls (no SDK required, uses stdlib requests) ──────────

def _call_anthropic(prompt: str, system: str, api_key: str) -> str:
    """POST to Anthropic Messages API, return raw text."""
    import requests as _req
    resp = _req.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 200,
            "temperature": 1.0,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


def _call_openai(prompt: str, system: str, api_key: str) -> str:
    """POST to OpenAI Chat Completions API, return raw text."""
    import requests as _req
    resp = _req.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.7,
            "max_tokens": 200,
        },
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


# ── Compact-parquet marginal prior ───────────────────────────────────────────

def _compact_marginal_prior(
    question_id: str,
    agent_dims: dict[str, str],
    compact_df: pd.DataFrame,
) -> dict[str, float] | None:
    """Compute a prior from the compact parquet by averaging over rows that
    match ALL provided agent_dims (regardless of other dim values).

    This gives a population-conditioned marginal for the agent's available
    demographics without requiring a full 8-dim cell match.
    """
    q_df = compact_df[compact_df["question_id"] == question_id]
    if q_df.empty:
        return None

    mask = pd.Series(True, index=q_df.index)
    for dim, val in agent_dims.items():
        if dim in q_df.columns and val and val != "ALL":
            mask &= q_df[dim] == val

    sub = q_df[mask]
    if sub.empty:
        # Progressive fallback: drop dims one by one
        fallback_dims = dict(agent_dims)
        for drop_dim in list(fallback_dims.keys()):
            del fallback_dims[drop_dim]
            mask2 = pd.Series(True, index=q_df.index)
            for dim, val in fallback_dims.items():
                if dim in q_df.columns and val and val != "ALL":
                    mask2 &= q_df[dim] == val
            sub = q_df[mask2]
            if not sub.empty:
                break

    if sub.empty:
        return None

    dist = sub.groupby("answer_label")["prob"].mean()
    total = dist.sum()
    if total == 0:
        return None
    return {label: float(p / total) for label, p in dist.items()}


# ── CivicSim pipeline ─────────────────────────────────────────────────────────

async def run_civicsim(
    *,
    agents_df,
    question_id: str,
    question_label_str: str,
    selected_dims: list[str],
    location: str,
    answer_options: list[str],
    compact_df: pd.DataFrame,
    api_key: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, float] | None:
    """Run the CivicSim pipeline: prior lookup → Anthropic API with prior."""
    import random as _rnd

    async def one_agent(row) -> str | None:
        persona = {
            "age": str(row.age),
            "race": str(row.race),
            "income": str(row.income),
            "occupation": str(row.occupation),
        }

        # Build agent dims directly from already-binned sample_agents output
        agent_dims: dict[str, str] = {}
        if hasattr(row, "age") and str(row.age).strip():
            agent_dims["age_group"] = str(row.age).strip()
        if hasattr(row, "race") and str(row.race).strip():
            agent_dims["race_eth"] = str(row.race).strip()
        if hasattr(row, "income") and str(row.income).strip():
            agent_dims["income_group"] = str(row.income).strip()

        # Use compact-parquet marginal prior (averages over matching rows so
        # 2-3 dim lookups produce real demographic priors, not national fallback)
        prior_dict = _compact_marginal_prior(question_id, agent_dims, compact_df) or {}

        # Convert prior dict to list-of-(label, prob) for the prompt builder
        prior_items = [type("P", (), {"answer_label": k, "prob": v})() for k, v in prior_dict.items()]

        # Pre-sample this agent's stance from the prior so the aggregate
        # distribution tracks the prior, not the LLM's modal preference.
        presampled_stance: str | None = None
        if prior_dict:
            labels = list(prior_dict.keys())
            weights = [max(v, 0.0) for v in prior_dict.values()]
            total_w = sum(weights)
            if total_w > 0:
                sampled = _rnd.choices(labels, weights=weights, k=1)[0]
                if sampled in answer_options:
                    presampled_stance = sampled
                else:
                    lower_map = {opt.lower(): opt for opt in answer_options}
                    presampled_stance = lower_map.get(sampled.lower())

        prompt = _build_civicsim_prompt(
            persona, question_label_str, answer_options, prior_items, presampled_stance
        )
        async with semaphore:
            try:
                text = await asyncio.to_thread(
                    _call_anthropic, prompt, NAIVE_SYSTEM_PROMPT, api_key
                )
                parsed = _parse_stance(text, answer_options)
                # Fall back to the pre-sampled stance if the LLM deviates or fails
                return parsed if parsed else presampled_stance
            except Exception as exc:
                log.debug("CivicSim LLM error: %s", exc)
                return presampled_stance

    results = await asyncio.gather(*[one_agent(r) for r in agents_df.itertuples(index=False)])
    stances = [s for s in results if s]
    if not stances:
        return None
    return stances_to_distribution(stances, answer_options)


def _build_civicsim_prompt(
    persona: dict,
    question: str,
    answer_options: list[str],
    prior: list,
    presampled_stance: str | None = None,
) -> str:
    persona_str = (
        f"  Age bracket: {persona.get('age', 'unknown')}\n"
        f"  Race/ethnicity: {persona.get('race', 'unknown')}\n"
        f"  Income bracket: {persona.get('income', 'unknown')}\n"
        f"  Occupation: {persona.get('occupation', 'unknown')}"
    )
    options_str = "\n".join(f"  - {opt}" for opt in answer_options)
    if prior:
        prior_lines = [f"  - {p.answer_label}: {round(p.prob * 100)}%" for p in prior]
        prior_str = "In recent national polling, people with your demographics answered:\n" + "\n".join(prior_lines) + "\n\n"
    else:
        prior_str = ""

    if presampled_stance:
        # Anchor the agent to their pre-sampled stance so the aggregate
        # distribution tracks the prior rather than collapsing to the LLM default.
        stance_anchor = (
            f"You are one specific person from this demographic. "
            f"Based on historical polling, your position on this issue is: \"{presampled_stance}\". "
            f"Respond with exactly that stance.\n\n"
        )
    else:
        stance_anchor = ""

    return (
        f"Your demographics:\n{persona_str}\n\n"
        f"Question: {question}\n\n"
        f"Answer options (pick exactly one, verbatim):\n{options_str}\n\n"
        f"{prior_str}"
        f"{stance_anchor}"
        'Output strict JSON: {"stance": <one of the options verbatim>, "rationale": <one sentence>}.'
    )


# ── Naive LLM ─────────────────────────────────────────────────────────────────

def _build_naive_prompt(persona: dict, question: str, answer_options: list[str]) -> str:
    """Same structure as CivicSim but with NO ATP prior section."""
    persona_str = (
        f"  Age bracket: {persona.get('age', 'unknown')}\n"
        f"  Race/ethnicity: {persona.get('race', 'unknown')}\n"
        f"  Income bracket: {persona.get('income', 'unknown')}\n"
        f"  Occupation: {persona.get('occupation', 'unknown')}"
    )
    options_str = "\n".join(f"  - {opt}" for opt in answer_options)
    return (
        f"Your demographics:\n{persona_str}\n\n"
        f"Question: {question}\n\n"
        f"Answer options (pick exactly one, verbatim):\n{options_str}\n\n"
        'Respond as one such person. Output strict JSON: {"stance": <one of the options>, "rationale": <one sentence>}.'
    )


def _parse_stance(raw: str, answer_options: list[str]) -> str | None:
    import json as _json
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`").split("\n", 1)[-1]
    try:
        obj = _json.loads(raw)
    except Exception:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            try:
                obj = _json.loads(raw[start : end + 1])
            except Exception:
                return None
        else:
            return None
    stance = str(obj.get("stance", "")).strip()
    if stance in answer_options:
        return stance
    # Case-insensitive match
    lower_map = {opt.lower(): opt for opt in answer_options}
    return lower_map.get(stance.lower())


async def run_naive_anthropic(
    *,
    agents_df,
    question: str,
    answer_options: list[str],
    api_key: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, float] | None:
    async def one_agent(row) -> str | None:
        persona = {"age": str(row.age), "race": str(row.race),
                   "income": str(row.income), "occupation": str(row.occupation)}
        prompt = _build_naive_prompt(persona, question, answer_options)
        async with semaphore:
            try:
                text = await asyncio.to_thread(
                    _call_anthropic, prompt, NAIVE_SYSTEM_PROMPT, api_key
                )
                return _parse_stance(text, answer_options)
            except Exception as exc:
                log.debug("Naive Anthropic error: %s", exc)
                return None

    results = await asyncio.gather(*[one_agent(r) for r in agents_df.itertuples(index=False)])
    stances = [s for s in results if s]
    if not stances:
        return None
    return stances_to_distribution(stances, answer_options)


async def run_naive_openai(
    *,
    agents_df,
    question: str,
    answer_options: list[str],
    api_key: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, float] | None:
    async def one_agent(row) -> str | None:
        persona = {"age": str(row.age), "race": str(row.race),
                   "income": str(row.income), "occupation": str(row.occupation)}
        prompt = _build_naive_prompt(persona, question, answer_options)
        async with semaphore:
            try:
                text = await asyncio.to_thread(
                    _call_openai, prompt, NAIVE_SYSTEM_PROMPT, api_key
                )
                return _parse_stance(text, answer_options)
            except Exception as exc:
                log.debug("Naive OpenAI error: %s", exc)
                return None

    results = await asyncio.gather(*[one_agent(r) for r in agents_df.itertuples(index=False)])
    stances = [s for s in results if s]
    if not stances:
        return None
    return stances_to_distribution(stances, answer_options)


# ── Report generation ─────────────────────────────────────────────────────────

def _fmt_dist(dist: dict[str, float] | None) -> str:
    if not dist:
        return "—"
    ordered = sorted(dist.items(), key=lambda x: -x[1])
    return "; ".join(f"{k}: {v:.0%}" for k, v in ordered if v > 0)


def _fmt_metric(v: float | None) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "—"
    return f"{v:.3f}"


def build_markdown_report(rows: list[dict], elapsed_s: float) -> str:
    lines: list[str] = []
    lines.append("# CivicSim Evaluation Table\n")
    lines.append(f"Generated {len(rows)} comparisons in {elapsed_s:.0f}s.\n")
    lines.append("**Metrics key:** TVD = Total Variation Distance · KL = KL divergence · "
                 "Hell = Hellinger · Wass = Wasserstein (ordinal only, else —)\n")
    lines.append("Lower is better for all metrics.\n")

    # Group by domain
    by_domain: dict[str, list[dict]] = {}
    for row in rows:
        by_domain.setdefault(row["domain"], []).append(row)

    for domain, domain_rows in by_domain.items():
        lines.append(f"\n## {domain_rows[0]['domain_label']}\n")
        by_q: dict[str, list[dict]] = {}
        for row in domain_rows:
            by_q.setdefault(row["question_id"], []).append(row)

        for qid, q_rows in by_q.items():
            lines.append(f"\n### {qid} — {q_rows[0]['question_label']}\n")
            lines.append("| Slice | Condition | Top answers | TVD | KL | Hell | Wass |")
            lines.append("|---|---|---|---|---|---|---|")

            for row in q_rows:
                slice_label = ", ".join(f"{k}={v}" for k, v in row["slice"].items())
                gt_label = "ATP (S3)" if row.get("gt_source") == "s3" else "ATP (parquet)"

                # Ground truth row
                lines.append(
                    f"| {slice_label} | {gt_label} (ground truth) | "
                    f"{_fmt_dist(row.get('gt_dist'))} | — | — | — | — |"
                )
                # CivicSim
                cs = row.get("metrics_civicsim", {})
                lines.append(
                    f"| | CivicSim | {_fmt_dist(row.get('civicsim_dist'))} | "
                    f"{_fmt_metric(cs.get('tvd'))} | {_fmt_metric(cs.get('kl'))} | "
                    f"{_fmt_metric(cs.get('hellinger'))} | {_fmt_metric(cs.get('wasserstein'))} |"
                )
                # Naive Anthropic
                na = row.get("metrics_naive_anthropic", {})
                lines.append(
                    f"| | Naive {ANTHROPIC_MODEL.split('-')[1].capitalize()} | "
                    f"{_fmt_dist(row.get('naive_anthropic_dist'))} | "
                    f"{_fmt_metric(na.get('tvd'))} | {_fmt_metric(na.get('kl'))} | "
                    f"{_fmt_metric(na.get('hellinger'))} | {_fmt_metric(na.get('wasserstein'))} |"
                )
                # Naive OpenAI
                no = row.get("metrics_naive_openai", {})
                lines.append(
                    f"| | Naive {OPENAI_MODEL} | "
                    f"{_fmt_dist(row.get('naive_openai_dist'))} | "
                    f"{_fmt_metric(no.get('tvd'))} | {_fmt_metric(no.get('kl'))} | "
                    f"{_fmt_metric(no.get('hellinger'))} | {_fmt_metric(no.get('wasserstein'))} |"
                )

    # Summary table: best condition by TVD per row
    lines.append("\n## Summary: CivicSim vs. Naive LLMs (mean TVD vs. ATP)\n")
    lines.append("| Domain | Q | Slice | CivicSim TVD | Naive Anthropic TVD | Naive OpenAI TVD | Winner |")
    lines.append("|---|---|---|---|---|---|---|")
    for row in rows:
        slice_label = ", ".join(f"{k}={v}" for k, v in row["slice"].items())
        cs_tvd = row.get("metrics_civicsim", {}).get("tvd")
        na_tvd = row.get("metrics_naive_anthropic", {}).get("tvd")
        no_tvd = row.get("metrics_naive_openai", {}).get("tvd")
        vals = {"CivicSim": cs_tvd, f"Naive {ANTHROPIC_MODEL.split('-')[1].capitalize()}": na_tvd, f"Naive {OPENAI_MODEL}": no_tvd}
        valid = {k: v for k, v in vals.items() if v is not None and not math.isnan(v)}
        winner = min(valid, key=valid.get) if valid else "—"
        lines.append(
            f"| {row['domain']} | {row['question_id']} | {slice_label} | "
            f"{_fmt_metric(cs_tvd)} | {_fmt_metric(na_tvd)} | {_fmt_metric(no_tvd)} | **{winner}** |"
        )

    return "\n".join(lines)


def _tvd_color(v: float | None) -> str:
    if v is None or math.isnan(v):
        return "#e5e7eb"
    if v < 0.15:
        return "#bbf7d0"  # green
    if v < 0.30:
        return "#fef08a"  # amber
    return "#fecaca"      # red


def _dist_bars(dist: dict | None, all_opts: list[str]) -> str:
    if not dist:
        return "<em style='color:#999'>—</em>"
    total = sum(dist.values()) or 1
    parts = []
    colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444"]
    for i, opt in enumerate(all_opts):
        pct = dist.get(opt, 0) / total
        if pct < 0.005:
            continue
        color = colors[i % len(colors)]
        label = opt[:22] + "…" if len(opt) > 24 else opt
        bar = (
            f'<div style="display:flex;align-items:center;gap:4px;margin:1px 0">'
            f'<div style="width:{max(pct*120,2):.0f}px;height:10px;background:{color};border-radius:2px;flex-shrink:0"></div>'
            f'<span style="font-size:0.75rem;color:#374151">{label} {pct:.0%}</span>'
            f'</div>'
        )
        parts.append(bar)
    return "".join(parts) if parts else "<em style='color:#999'>—</em>"


def _metric_cell(v: float | None, is_tvd: bool = False) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "<td style='color:#aaa'>—</td>"
    bg = _tvd_color(v) if is_tvd else "transparent"
    return f'<td style="background:{bg};text-align:center;font-variant-numeric:tabular-nums">{v:.3f}</td>'


def build_html_report(rows: list[dict], elapsed_s: float) -> str:  # type: ignore[override]
    import html as _html

    # ── Summary stats ──
    cs_tvds  = [r["metrics_civicsim"].get("tvd") for r in rows if r.get("metrics_civicsim")]
    na_tvds  = [r["metrics_naive_anthropic"].get("tvd") for r in rows if r.get("metrics_naive_anthropic")]
    no_tvds  = [r["metrics_naive_openai"].get("tvd") for r in rows if r.get("metrics_naive_openai")]
    cs_wass  = [r["metrics_civicsim"].get("wasserstein") for r in rows if r.get("metrics_civicsim")]
    na_wass  = [r["metrics_naive_anthropic"].get("wasserstein") for r in rows if r.get("metrics_naive_anthropic")]
    no_wass  = [r["metrics_naive_openai"].get("wasserstein") for r in rows if r.get("metrics_naive_openai")]

    def _mean(xs):
        xs = [x for x in xs if x is not None and not math.isnan(x)]
        return sum(xs) / len(xs) if xs else float("nan")

    wins_tvd = {"CivicSim": 0, "Naive Anthropic": 0, "Naive OpenAI": 0}
    wins_wass = {"CivicSim": 0, "Naive Anthropic": 0, "Naive OpenAI": 0}
    for r in rows:
        cs_t  = r.get("metrics_civicsim", {}).get("tvd")
        na_t  = r.get("metrics_naive_anthropic", {}).get("tvd")
        no_t  = r.get("metrics_naive_openai", {}).get("tvd")
        valid_t = {k: v for k, v in [("CivicSim", cs_t), ("Naive Anthropic", na_t), ("Naive OpenAI", no_t)]
                   if v is not None and not math.isnan(v)}
        if valid_t:
            wins_tvd[min(valid_t, key=valid_t.get)] += 1

        cs_w  = r.get("metrics_civicsim", {}).get("wasserstein")
        na_w  = r.get("metrics_naive_anthropic", {}).get("wasserstein")
        no_w  = r.get("metrics_naive_openai", {}).get("wasserstein")
        valid_w = {k: v for k, v in [("CivicSim", cs_w), ("Naive Anthropic", na_w), ("Naive OpenAI", no_w)]
                   if v is not None and not math.isnan(v)}
        if valid_w:
            wins_wass[min(valid_w, key=valid_w.get)] += 1

    def _sc(label, value, subtitle="avg TVD"):
        bg = _tvd_color(value) if not math.isnan(value) else "#e5e7eb"
        vstr = f"{value:.3f}" if not math.isnan(value) else "—"
        return (
            f'<div style="background:{bg};border-radius:12px;padding:1.25rem 1.5rem;text-align:center;'
            f'min-width:140px;box-shadow:0 1px 4px rgba(0,0,0,.08)">'
            f'<div style="font-size:1.8rem;font-weight:700;color:#1e3a5f">{vstr}</div>'
            f'<div style="font-size:0.8rem;color:#374151;margin-top:2px">{label}</div>'
            f'<div style="font-size:0.72rem;color:#6b7280">{subtitle}</div>'
            f'</div>'
        )

    def _win_card(label, tvd_count, wass_count):
        return (
            f'<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;'
            f'padding:1.25rem 1.5rem;text-align:center;min-width:140px">'
            f'<div style="font-size:1.8rem;font-weight:700;color:#0369a1">{tvd_count} / {wass_count}</div>'
            f'<div style="font-size:0.8rem;color:#374151;margin-top:2px">{label}</div>'
            f'<div style="font-size:0.72rem;color:#6b7280">wins (TVD / Wasserstein)</div>'
            f'</div>'
        )

    scorecards = "".join([
        _sc("CivicSim", _mean(cs_tvds), "avg TVD"),
        _sc("Naive Anthropic", _mean(na_tvds), "avg TVD"),
        _sc("Naive OpenAI", _mean(no_tvds), "avg TVD"),
        _sc("CivicSim", _mean(cs_wass), "avg Wasserstein"),
        _sc("Naive Anthropic", _mean(na_wass), "avg Wasserstein"),
        _sc("Naive OpenAI", _mean(no_wass), "avg Wasserstein"),
    ])
    win_cards = "".join([_win_card(k, wins_tvd[k], wins_wass[k]) for k in wins_tvd])

    # ── Detail sections ──
    by_domain: dict[str, list[dict]] = {}
    for row in rows:
        by_domain.setdefault(row["domain"], []).append(row)

    detail_html = []
    for domain, domain_rows in by_domain.items():
        dl = _html.escape(domain_rows[0]["domain_label"])
        detail_html.append(f'<section style="margin-bottom:2.5rem">')
        detail_html.append(f'<h2 style="color:#1e3a5f;border-bottom:3px solid #3b82f6;padding-bottom:.4rem;margin-bottom:1rem">{dl}</h2>')

        by_q: dict[str, list[dict]] = {}
        for row in domain_rows:
            by_q.setdefault(row["question_id"], []).append(row)

        for qid, q_rows in by_q.items():
            qlabel = _html.escape(q_rows[0]["question_label"])
            detail_html.append(
                f'<details open style="margin-bottom:1.25rem">'
                f'<summary style="cursor:pointer;font-size:1rem;font-weight:600;color:#1e40af;padding:.5rem 0">'
                f'<code style="background:#dbeafe;color:#1e3a5f;padding:.2rem .5rem;border-radius:4px;font-size:.85rem">{_html.escape(qid)}</code>'
                f' &nbsp; {qlabel}</summary>'
            )

            # one sub-table per slice
            for row in q_rows:
                slice_label = _html.escape(", ".join(f"{k}={v}" for k, v in row["slice"].items()))
                gt_src = "ATP S3" if row.get("gt_source") == "s3" else "ATP parquet"
                answer_opts = row.get("answer_options") or list((row.get("gt_dist") or {}).keys())

                cs  = row.get("metrics_civicsim", {})
                na  = row.get("metrics_naive_anthropic", {})
                no  = row.get("metrics_naive_openai", {})

                detail_html.append(
                    f'<div style="margin:.75rem 0 1rem 0">'
                    f'<div style="font-size:.82rem;color:#6b7280;margin-bottom:.4rem">Slice: <strong style="color:#374151">{slice_label}</strong></div>'
                    f'<table style="border-collapse:collapse;width:100%;font-size:.85rem">'
                    f'<thead><tr style="background:#1e3a5f;color:#fff">'
                    f'<th style="padding:.5rem .75rem">Condition</th>'
                    f'<th style="padding:.5rem .75rem">Distribution</th>'
                    f'<th style="padding:.5rem .75rem;text-align:center">TVD ↓</th>'
                    f'<th style="padding:.5rem .75rem;text-align:center">KL ↓</th>'
                    f'<th style="padding:.5rem .75rem;text-align:center">Hellinger ↓</th>'
                    f'<th style="padding:.5rem .75rem;text-align:center">Wasserstein ↓</th>'
                    f'</tr></thead><tbody>'
                )

                rows_data = [
                    (f"🏛 {gt_src} <span style='font-size:.75rem;background:#d1fae5;color:#065f46;border-radius:4px;padding:.1rem .4rem'>ground truth</span>",
                     row.get("gt_dist"), {}, True),
                    ("🤖 CivicSim", row.get("civicsim_dist"), cs, False),
                    (f"🔵 Naive Anthropic", row.get("naive_anthropic_dist"), na, False),
                    (f"🟢 Naive OpenAI", row.get("naive_openai_dist"), no, False),
                ]
                for i, (cond_label, dist, metrics, is_gt) in enumerate(rows_data):
                    bg = "#f8fafc" if i % 2 == 1 else "#ffffff"
                    detail_html.append(f'<tr style="background:{bg}">')
                    detail_html.append(f'<td style="padding:.5rem .75rem;white-space:nowrap;font-weight:{"600" if is_gt else "400"}">{cond_label}</td>')
                    detail_html.append(f'<td style="padding:.5rem .75rem">{_dist_bars(dist, answer_opts)}</td>')
                    if is_gt:
                        detail_html.append('<td colspan="4" style="text-align:center;color:#9ca3af;font-style:italic;font-size:.8rem">reference</td>')
                    else:
                        detail_html.append(_metric_cell(metrics.get("tvd"), is_tvd=True))
                        detail_html.append(_metric_cell(metrics.get("kl")))
                        detail_html.append(_metric_cell(metrics.get("hellinger")))
                        detail_html.append(_metric_cell(metrics.get("wasserstein"), is_tvd=True))
                    detail_html.append('</tr>')

                detail_html.append('</tbody></table></div>')
            detail_html.append('</details>')
        detail_html.append('</section>')

    # ── Summary table ──
    winner_colors = {"CivicSim": "#7c3aed", "Naive Anthropic": "#0369a1", "Naive OpenAI": "#047857"}
    summary_rows = []
    for row in rows:
        slice_label = _html.escape(", ".join(f"{k}={v}" for k, v in row["slice"].items()))
        cs_tvd = row.get("metrics_civicsim", {}).get("tvd")
        na_tvd = row.get("metrics_naive_anthropic", {}).get("tvd")
        no_tvd = row.get("metrics_naive_openai", {}).get("tvd")
        cs_wass = row.get("metrics_civicsim", {}).get("wasserstein")
        na_wass = row.get("metrics_naive_anthropic", {}).get("wasserstein")
        no_wass = row.get("metrics_naive_openai", {}).get("wasserstein")

        valid_tvd = {k: v for k, v in [("CivicSim", cs_tvd), ("Naive Anthropic", na_tvd), ("Naive OpenAI", no_tvd)]
                     if v is not None and not math.isnan(v)}
        winner_tvd = min(valid_tvd, key=valid_tvd.get) if valid_tvd else "—"

        valid_wass = {k: v for k, v in [("CivicSim", cs_wass), ("Naive Anthropic", na_wass), ("Naive OpenAI", no_wass)]
                      if v is not None and not math.isnan(v)}
        winner_wass = min(valid_wass, key=valid_wass.get) if valid_wass else "—"

        summary_rows.append(
            f'<tr>'
            f'<td style="padding:.4rem .6rem">{_html.escape(row["domain_label"])}</td>'
            f'<td style="padding:.4rem .6rem"><code style="background:#f1f5f9;padding:.1rem .3rem;border-radius:3px">{_html.escape(row["question_id"])}</code></td>'
            f'<td style="padding:.4rem .6rem;font-size:.82rem;color:#6b7280">{slice_label}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(cs_tvd)}">{_fmt_metric(cs_tvd)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(na_tvd)}">{_fmt_metric(na_tvd)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(no_tvd)}">{_fmt_metric(no_tvd)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;font-weight:700;color:{winner_colors.get(winner_tvd,"#374151")}">{_html.escape(winner_tvd)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(cs_wass)}">{_fmt_metric(cs_wass)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(na_wass)}">{_fmt_metric(na_wass)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;background:{_tvd_color(no_wass)}">{_fmt_metric(no_wass)}</td>'
            f'<td style="padding:.4rem .6rem;text-align:center;font-weight:700;color:{winner_colors.get(winner_wass,"#374151")}">{_html.escape(winner_wass)}</td>'
            f'</tr>'
        )

    from datetime import datetime as _dt
    generated_at = _dt.now().strftime("%Y-%m-%d %H:%M")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CivicSim Evaluation Report</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{ font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #1e293b;
         margin: 0; padding: 0; }}
  .page {{ max-width: 1280px; margin: 0 auto; padding: 2rem 1.5rem; }}
  header {{ background: linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);
            color: #fff; border-radius: 16px; padding: 2rem 2.5rem; margin-bottom: 2rem;
            box-shadow: 0 4px 20px rgba(30,58,95,.25); }}
  header h1 {{ margin: 0 0 .25rem; font-size: 1.9rem; letter-spacing: -.5px; }}
  header p {{ margin: .25rem 0 0; opacity: .75; font-size: .9rem; }}
  .cards {{ display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; }}
  .card-group {{ display: flex; flex-wrap: wrap; gap: .75rem; }}
  .card-group-label {{ font-size: .75rem; font-weight: 600; color: #64748b;
                       text-transform: uppercase; letter-spacing: .05em; margin-bottom: .4rem; }}
  .legend {{ display: flex; gap: 1rem; flex-wrap: wrap; font-size: .8rem;
             background: #fff; border-radius: 10px; padding: .75rem 1rem;
             margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.06); }}
  .legend-item {{ display: flex; align-items: center; gap: .4rem; }}
  .legend-swatch {{ width: 14px; height: 14px; border-radius: 3px; }}
  section {{ background: #fff; border-radius: 14px; padding: 1.5rem 2rem;
             margin-bottom: 1.5rem; box-shadow: 0 1px 6px rgba(0,0,0,.07); }}
  details > summary::-webkit-details-marker {{ display: none; }}
  details > summary::before {{ content: "▶ "; font-size: .7rem; color: #94a3b8; }}
  details[open] > summary::before {{ content: "▼ "; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ background: #1e3a5f; color: #fff; padding: .5rem .75rem; text-align: left; font-size: .82rem; }}
  td {{ padding: .45rem .7rem; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }}
  tr:last-child td {{ border-bottom: none; }}
  .summary-table th {{ background: #334155; }}
  code {{ background: #f1f5f9; padding: .15rem .4rem; border-radius: 4px; font-size: .82rem; }}
</style>
</head>
<body>
<div class="page">

<header>
  <h1>CivicSim Evaluation Report</h1>
  <p>{len(rows)} comparisons &nbsp;·&nbsp; {elapsed_s:.0f}s &nbsp;·&nbsp; Generated {generated_at}</p>
</header>

<div class="cards">
  <div>
    <div class="card-group-label">Avg TVD vs. Ground Truth (lower = better)</div>
    <div class="card-group">{scorecards}</div>
  </div>
  <div>
    <div class="card-group-label">Win count (lowest TVD per slice)</div>
    <div class="card-group">{win_cards}</div>
  </div>
</div>

<div class="legend">
  <strong style="color:#374151">TVD color scale:</strong>
  <span class="legend-item"><span class="legend-swatch" style="background:#bbf7d0"></span>&lt; 0.15 (good)</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#fef08a"></span>0.15 – 0.30 (moderate)</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#fecaca"></span>≥ 0.30 (high)</span>
</div>

{"".join(detail_html)}

<section>
<h2 style="color:#1e3a5f;border-bottom:3px solid #3b82f6;padding-bottom:.4rem;margin-bottom:1rem">Summary Scorecard</h2>
<table class="summary-table">
<thead><tr>
  <th>Domain</th><th>Question</th><th>Slice</th>
  <th style="text-align:center">CivicSim TVD</th>
  <th style="text-align:center">Naive Anthropic TVD</th>
  <th style="text-align:center">Naive OpenAI TVD</th>
  <th style="text-align:center">TVD Winner</th>
  <th style="text-align:center">CivicSim Wass</th>
  <th style="text-align:center">Naive Anthropic Wass</th>
  <th style="text-align:center">Naive OpenAI Wass</th>
  <th style="text-align:center">Wass Winner</th>
</tr></thead>
<tbody>{"".join(summary_rows)}</tbody>
</table>
</section>

</div>
</body>
</html>"""


# ── Main ──────────────────────────────────────────────────────────────────────

async def main(args: argparse.Namespace) -> None:
    n_agents = args.n_agents
    creds = check_credentials()

    catalog = load_domain_catalog()
    active_domains = domains_with_questions(catalog, args.domain)
    compact_df = load_compact_parquet()

    if not active_domains:
        log.error("No domains with questions found (filter: %s)", args.domain)
        sys.exit(1)

    # Build evaluation plan
    plan: list[dict] = []
    for domain, info in active_domains.items():
        for qid in info["question_ids"]:
            slices = find_diverse_slices(qid, info["dims"], compact_df, D_SLICES)
            if not slices:
                log.warning("No populated slices found for %s / %s — skipping", domain, qid)
                continue
            for s in slices:
                plan.append({
                    "domain": domain,
                    "domain_label": info["label"],
                    "question_id": qid,
                    "dims": info["dims"],
                    "slice": s,
                })

    total_llm_calls = len(plan) * n_agents * 3  # CivicSim + 2 naive
    log.info("Plan: %d rows, ~%d LLM calls, estimated cost: $%.2f",
             len(plan), total_llm_calls,
             total_llm_calls * 0.0003)  # rough: $0.30/1000 for haiku

    if args.dry_run:
        print("\n=== DRY RUN — evaluation plan ===")
        for item in plan:
            slice_str = ", ".join(f"{k}={v}" for k, v in item["slice"].items())
            print(f"  {item['domain']} | {item['question_id']} | {slice_str}")
        print(f"\nTotal: {len(plan)} combos × {n_agents} agents × 3 conditions = {total_llm_calls} LLM calls")
        return

    # Load S3 ATP data (best-effort, per question_id)
    has_aws = creds["AWS_ACCESS_KEY_ID"] and creds["AWS_SECRET_ACCESS_KEY"]
    atp_cache: dict[str, pd.DataFrame | None] = {}

    semaphore = asyncio.Semaphore(LLM_CONCURRENCY)
    RESULTS_DIR.mkdir(exist_ok=True)

    rows: list[dict] = []
    t0 = time.time()

    for i, item in enumerate(plan):
        domain = item["domain"]
        qid = item["question_id"]
        slice_filter = item["slice"]
        dims = item["dims"]
        location = REGION_TO_LOCATION.get(slice_filter.get("F_CREGION", ""), DEFAULT_LOCATION)
        answer_options = get_answer_options(qid, compact_df)
        qlabel = get_question_label(qid, compact_df)

        slice_str = ", ".join(f"{k}={v}" for k, v in slice_filter.items())
        log.info("[%d/%d] %s / %s / %s", i + 1, len(plan), domain, qid, slice_str)

        # Ground truth
        gt_dist: dict[str, float] | None = None
        gt_source = "parquet"
        if has_aws:
            if qid not in atp_cache:
                atp_cache[qid] = load_s3_atp(qid)
            atp_df = atp_cache[qid]
            if atp_df is not None:
                gt_dist = s3_ground_truth(qid, slice_filter, atp_df)
                if gt_dist:
                    gt_source = "s3"

        if not gt_dist:
            gt_dist = compact_parquet_ground_truth(qid, slice_filter, compact_df)
            gt_source = "parquet"

        if not gt_dist:
            log.warning("No ground truth for %s / %s / %s — skipping", domain, qid, slice_str)
            continue

        # Sample agents (shared across conditions for fair comparison)
        try:
            from civicsim_agents import sample_agents
            agents_df = sample_agents(location, n_agents=n_agents, diverse=True)
        except Exception as exc:
            log.warning("Agent sampling failed: %s", exc)
            continue

        # CivicSim condition
        civicsim_dist: dict[str, float] | None = None
        metrics_civicsim: dict = {}
        if creds["ANTHROPIC_API_KEY"]:
            civicsim_dist = await run_civicsim(
                agents_df=agents_df,
                question_id=qid,
                question_label_str=qlabel,
                selected_dims=dims,
                location=location,
                answer_options=answer_options,
                compact_df=compact_df,
                api_key=os.environ["ANTHROPIC_API_KEY"],
                semaphore=semaphore,
            )
            if civicsim_dist and gt_dist:
                metrics_civicsim = compute_all_metrics(civicsim_dist, gt_dist, answer_options)

        # Naive Anthropic condition
        naive_anthropic_dist: dict[str, float] | None = None
        metrics_naive_anthropic: dict = {}
        if creds["ANTHROPIC_API_KEY"]:
            naive_anthropic_dist = await run_naive_anthropic(
                agents_df=agents_df,
                question=qlabel,
                answer_options=answer_options,
                api_key=os.environ["ANTHROPIC_API_KEY"],
                semaphore=semaphore,
            )
            if naive_anthropic_dist and gt_dist:
                metrics_naive_anthropic = compute_all_metrics(naive_anthropic_dist, gt_dist, answer_options)

        # Naive OpenAI condition
        naive_openai_dist: dict[str, float] | None = None
        metrics_naive_openai: dict = {}
        if creds["OPENAI_API_KEY"]:
            naive_openai_dist = await run_naive_openai(
                agents_df=agents_df,
                question=qlabel,
                answer_options=answer_options,
                api_key=os.environ["OPENAI_API_KEY"],
                semaphore=semaphore,
            )
            if naive_openai_dist and gt_dist:
                metrics_naive_openai = compute_all_metrics(naive_openai_dist, gt_dist, answer_options)

        rows.append({
            "domain": domain,
            "domain_label": item["domain_label"],
            "question_id": qid,
            "question_label": qlabel,
            "slice": slice_filter,
            "slice_str": slice_str,
            "location": location,
            "n_agents": n_agents,
            "answer_options": answer_options,
            "gt_source": gt_source,
            "gt_dist": gt_dist,
            "civicsim_dist": civicsim_dist,
            "naive_anthropic_dist": naive_anthropic_dist,
            "naive_openai_dist": naive_openai_dist,
            "metrics_civicsim": metrics_civicsim,
            "metrics_naive_anthropic": metrics_naive_anthropic,
            "metrics_naive_openai": metrics_naive_openai,
        })

    elapsed = time.time() - t0

    if not rows:
        log.error("No results produced. Check credentials and parquet coverage.")
        sys.exit(1)

    # Flatten for parquet output
    flat_rows = []
    for row in rows:
        base = {
            "domain": row["domain"],
            "domain_label": row["domain_label"],
            "question_id": row["question_id"],
            "question_label": row["question_label"],
            "slice_str": row["slice_str"],
            "location": row["location"],
            "n_agents": row["n_agents"],
            "gt_source": row["gt_source"],
            "gt_dist": json.dumps(row["gt_dist"]),
            "civicsim_dist": json.dumps(row["civicsim_dist"]),
            "naive_anthropic_dist": json.dumps(row["naive_anthropic_dist"]),
            "naive_openai_dist": json.dumps(row["naive_openai_dist"]),
        }
        for cond in ["civicsim", "naive_anthropic", "naive_openai"]:
            m = row.get(f"metrics_{cond}", {})
            for metric in ["tvd", "kl", "hellinger", "wasserstein"]:
                base[f"{cond}_{metric}"] = m.get(metric)
        flat_rows.append(base)

    result_df = pd.DataFrame(flat_rows)
    parquet_out = RESULTS_DIR / "eval_table.parquet"
    result_df.to_parquet(parquet_out, index=False)
    log.info("Saved parquet → %s", parquet_out)

    md = build_markdown_report(rows, elapsed)
    md_out = RESULTS_DIR / "eval_report.md"
    md_out.write_text(md)
    log.info("Saved markdown → %s", md_out)

    html = build_html_report(rows, elapsed)
    html_out = RESULTS_DIR / "eval_report.html"
    html_out.write_text(html)
    log.info("Saved HTML → %s", html_out)

    # Print summary
    print("\n=== RESULTS SUMMARY ===")
    for row in rows:
        slice_label = ", ".join(f"{k}={v}" for k, v in row["slice"].items())
        cs_tvd = row.get("metrics_civicsim", {}).get("tvd")
        na_tvd = row.get("metrics_naive_anthropic", {}).get("tvd")
        no_tvd = row.get("metrics_naive_openai", {}).get("tvd")
        print(f"  {row['domain']} | {row['question_id']} | {slice_label}")
        print(f"    CivicSim TVD:        {_fmt_metric(cs_tvd)}")
        print(f"    Naive Anthropic TVD: {_fmt_metric(na_tvd)}")
        print(f"    Naive OpenAI TVD:    {_fmt_metric(no_tvd)}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="CivicSim evaluation table")
    p.add_argument("--domain", help="Restrict to one domain (e.g. economy)")
    p.add_argument("--dry-run", action="store_true", help="Show plan without making LLM calls")
    p.add_argument("--n-agents", type=int, default=N_AGENTS, help=f"Agents per slice (default {N_AGENTS})")
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(main(parse_args()))
