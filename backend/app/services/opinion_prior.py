"""ATP-derived opinion prior lookup with demographic-cell backoff.

The backing parquet (``data/atp_priors/policy_priors.parquet``) has schema:

    question_id        STRING
    question_label     STRING
    age_group          STRING       (nullable -> 'ALL' for marginals)
    gender             STRING
    race_eth           STRING
    education_group    STRING
    income_group       STRING
    urbanicity         STRING
    answer_label       STRING
    prob               DOUBLE       per (cell, question) sums to 1.0

Every (question_id, demographic_cell) is one group of rows that sums to 1.
We always include a fully-marginal row (all dims = 'ALL') as a fallback.
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache
from pathlib import Path

import duckdb

from app.core.config import get_settings
from app.core.errors import PriorsUnavailableError, QuestionNotFoundError
from app.models.poll import AnswerProb, QuestionMeta

logger = logging.getLogger(__name__)

# Order matters: drop the least-informative dimension first.
_BACKOFF_ORDER = [
    "urbanicity",
    "income_group",
    "education_group",
    "race_eth",
    "gender",
    "age_group",
]
_ALL_DIMS = list(reversed(_BACKOFF_ORDER))  # most-informative first
_MARGINAL = "ALL"

_lock = threading.Lock()


def _priors_path() -> Path:
    return get_settings().atp_priors_resolved_path


@lru_cache(maxsize=1)
def _conn() -> duckdb.DuckDBPyConnection:
    path = _priors_path()
    if not path.exists():
        raise PriorsUnavailableError(
            f"ATP priors parquet not found at {path}. Run scripts/build_atp_priors.py "
            "or set ATP_PRIORS_PATH."
        )
    con = duckdb.connect(database=":memory:")
    con.execute(f"CREATE VIEW priors AS SELECT * FROM read_parquet('{path.as_posix()}')")
    return con


def _safe_query(sql: str, params: list) -> list[tuple]:
    with _lock:  # duckdb connections are not thread-safe for concurrent execute
        return _conn().execute(sql, params).fetchall()


def list_questions() -> list[QuestionMeta]:
    try:
        rows = _safe_query(
            "SELECT question_id, MAX(question_label) AS lbl, "
            "ARRAY_AGG(DISTINCT answer_label ORDER BY answer_label) AS answers "
            "FROM priors GROUP BY question_id ORDER BY question_id",
            [],
        )
    except PriorsUnavailableError:
        return []
    return [
        QuestionMeta(question_id=q, question_label=lbl, answer_labels=list(answers))
        for q, lbl, answers in rows
    ]


def _normalize_filter(filt: dict | None) -> dict[str, str]:
    base = {dim: _MARGINAL for dim in _ALL_DIMS}
    if not filt:
        return base
    for dim in _ALL_DIMS:
        v = filt.get(dim)
        if v:
            base[dim] = str(v)
    return base


def _try_lookup(question_id: str, cell: dict[str, str]) -> list[AnswerProb]:
    where = " AND ".join(f"{dim} = ?" for dim in _ALL_DIMS)
    rows = _safe_query(
        f"SELECT answer_label, prob FROM priors "
        f"WHERE question_id = ? AND {where} "
        f"ORDER BY prob DESC",
        [question_id, *[cell[d] for d in _ALL_DIMS]],
    )
    return [AnswerProb(answer_label=a, prob=float(p)) for a, p in rows]


def question_exists(question_id: str) -> bool:
    try:
        rows = _safe_query("SELECT 1 FROM priors WHERE question_id = ? LIMIT 1", [question_id])
    except PriorsUnavailableError:
        return False
    return bool(rows)


def lookup_distribution(
    *,
    question_id: str,
    demographic_filter: dict | None,
) -> tuple[list[AnswerProb], dict, list[str]]:
    """Look up the ATP-derived distribution for a (question, cell) with backoff.

    Returns ``(distribution, used_filter, backoff_steps_taken)``.
    """
    if not question_exists(question_id):
        raise QuestionNotFoundError(f"Unknown question_id: {question_id}")

    cell = _normalize_filter(demographic_filter)
    dropped: list[str] = []

    dist = _try_lookup(question_id, cell)
    if dist:
        return dist, cell.copy(), dropped

    for dim in _BACKOFF_ORDER:
        if cell[dim] == _MARGINAL:
            continue
        cell[dim] = _MARGINAL
        dropped.append(dim)
        dist = _try_lookup(question_id, cell)
        if dist:
            return dist, cell.copy(), dropped

    # Fully marginal lookup as a last resort.
    dist = _try_lookup(question_id, {d: _MARGINAL for d in _ALL_DIMS})
    if dist:
        return dist, {d: _MARGINAL for d in _ALL_DIMS}, dropped + ["all_remaining"]

    raise QuestionNotFoundError(
        f"No prior found for question {question_id!r} even at the population marginal."
    )


def question_label(question_id: str) -> str:
    rows = _safe_query(
        "SELECT MAX(question_label) FROM priors WHERE question_id = ?",
        [question_id],
    )
    if not rows or rows[0][0] is None:
        raise QuestionNotFoundError(f"Unknown question_id: {question_id}")
    return str(rows[0][0])


def match_free_text(query: str) -> str | None:
    """Cheap nearest-question matcher: token-overlap over question_label."""
    q_tokens = {t.lower() for t in _tokenize(query) if len(t) > 2}
    if not q_tokens:
        return None
    try:
        rows = _safe_query("SELECT DISTINCT question_id, question_label FROM priors", [])
    except PriorsUnavailableError:
        return None

    best_id, best_score = None, 0
    for qid, lbl in rows:
        tokens = {t.lower() for t in _tokenize(lbl) if len(t) > 2}
        score = len(q_tokens & tokens)
        if score > best_score:
            best_id, best_score = qid, score
    return best_id


def _tokenize(s: str) -> list[str]:
    out: list[str] = []
    cur = []
    for ch in s:
        if ch.isalnum():
            cur.append(ch)
        else:
            if cur:
                out.append("".join(cur))
                cur = []
    if cur:
        out.append("".join(cur))
    return out


def map_agent_to_filter(agent: dict) -> dict:
    """Project a sampled agent's raw demographics onto the ATP cell vocabulary.

    The ACS-derived sampled agents use bracket strings (e.g. "30 to 34 years")
    while the ATP priors parquet uses harmonized buckets (e.g. "30-49"). This
    function performs the projection. Unknown values fall back to ``ALL``.
    """
    age = _bin_age(agent.get("age", ""))
    race = _bin_race(agent.get("race", ""))
    income = _bin_income(agent.get("income", ""))
    return {
        "age_group": age,
        "race_eth": race,
        "income_group": income,
    }


def _bin_age(label: str) -> str:
    label = label.strip().lower()
    if not label:
        return _MARGINAL
    if "under" in label or "5 to 9" in label or "10 to 14" in label or "15 to 19" in label:
        return "under_18"
    if any(x in label for x in ["20 to 24", "25 to 29"]):
        return "18-29"
    if any(x in label for x in ["30 to 34", "35 to 39", "40 to 44", "45 to 49"]):
        return "30-49"
    if any(x in label for x in ["50 to 54", "55 to 59", "60 to 64"]):
        return "50-64"
    return "65+"


def _bin_race(label: str) -> str:
    label = label.strip().lower()
    if "white" in label:
        return "White"
    if "black" in label or "african" in label:
        return "Black or African-American"
    if "asian" in label or "pacific islander" in label or "native hawaiian" in label:
        return "Asian or Asian-American"
    return "Other"


def _bin_income(label: str) -> str:
    label = label.strip().lower()
    # ACS bracket -> ATP bucket
    if "less than" in label or "10,000 to 14,999" in label or "15,000 to 24,999" in label:
        return "below_30000"
    if "25,000 to 34,999" in label:
        return "30000_to_40000"
    if "35,000 to 49,999" in label:
        return "40000_to_50000"
    if "50,000 to 74,999" in label:
        return "50000_to_75000"
    if "75,000 to 99,999" in label:
        return "75000_to_100000"
    return "above_100000"
