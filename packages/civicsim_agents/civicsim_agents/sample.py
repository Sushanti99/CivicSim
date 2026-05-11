"""Core sampling logic for civicsim_agents.

Refactored from the original ``civicsim-agent_probabilisitc_model/main.py``
into an importable, location-aware library.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np
import pandas as pd


def _candidate_data_roots() -> list[str]:
    """Where to look for per-location demographic CSVs, in priority order.

    1. ``CIVICSIM_DATA_ROOT`` env var (lets the backend point at the
       repo-level ``data/locations/`` so a single source of truth wins).
    2. ``../../data/locations`` relative to this file, walking up to find
       a checked-out repo layout.
    3. The package-internal ``data/`` directory (ships with pip install).
    """
    roots: list[str] = []
    env = os.environ.get("CIVICSIM_DATA_ROOT")
    if env:
        roots.append(env)
    here = os.path.dirname(os.path.abspath(__file__))
    for _ in range(6):
        candidate = os.path.join(here, "data", "locations")
        if os.path.isdir(candidate):
            roots.append(candidate)
            break
        here = os.path.dirname(here)
    roots.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
    return roots


def _data_root() -> str:
    for r in _candidate_data_roots():
        if os.path.isdir(r):
            return r
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def list_locations() -> list[str]:
    """List location IDs available for sampling."""
    root = _data_root()
    if not os.path.isdir(root):
        return []
    return sorted(
        d for d in os.listdir(root)
        if os.path.isdir(os.path.join(root, d)) and not d.startswith(".")
    )


def _data_dir(location: str) -> str:
    location = location.replace(",", "_").strip().lower().replace(" ", "_")
    path = os.path.join(_data_root(), location)
    if not os.path.isdir(path):
        raise FileNotFoundError(
            f"Unknown location {location!r}. Available: {list_locations()}"
        )
    return path


def load_distributions(location: str):
    """Load (df_age, df_race, df_occupation, df_income) for a location."""
    d = _data_dir(location)
    return (
        pd.read_csv(os.path.join(d, "age.csv")),
        pd.read_csv(os.path.join(d, "race.csv")),
        pd.read_csv(os.path.join(d, "occupation.csv")),
        pd.read_csv(os.path.join(d, "income.csv")),
    )


def _normalize_to_probs(weights: np.ndarray) -> np.ndarray:
    w = np.asarray(weights, dtype=float)
    return w / w.sum()


def _proportional_alloc(n: int, weights: np.ndarray) -> np.ndarray:
    """Largest-remainder allocation of ``n`` units across categories."""
    w = np.asarray(weights, dtype=float)
    p = w / w.sum()
    exact = p * n
    counts = np.floor(exact).astype(int)
    remainder = n - int(counts.sum())
    frac = exact - counts
    if remainder > 0:
        idx = np.argsort(frac)[::-1][:remainder]
        counts[idx] += 1
    return counts


@dataclass(frozen=True)
class Agent:
    agent_id: int
    age: str
    race: str
    income: str
    occupation: str

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "age": self.age,
            "race": self.race,
            "income": self.income,
            "occupation": self.occupation,
        }


def sample_agents(
    location: str,
    n_agents: int,
    *,
    seed: int | None = None,
    diverse: bool = True,
) -> pd.DataFrame:
    """Sample ``n_agents`` synthetic agents for ``location``.

    With ``diverse=True`` (default) the sample exactly matches the marginal
    population distributions via largest-remainder allocation, then independently
    shuffles each demographic axis. With ``diverse=False`` we draw each
    attribute independently from the marginal distribution.

    Returns a DataFrame with columns: ``agent_id, age, race, income, occupation``.
    """
    if n_agents <= 0:
        raise ValueError("n_agents must be positive")

    rng = np.random.default_rng(seed)

    df_age, df_race, df_occupation, df_income = load_distributions(location)
    cat_age = df_age["category"].values
    cat_race = df_race["category"].values
    cat_occ = df_occupation["category"].values
    cat_inc = df_income["category"].values

    if diverse:
        n_age = _proportional_alloc(n_agents, df_age["count"].values.astype(float))
        n_race = _proportional_alloc(n_agents, df_race["value"].values.astype(float))
        n_occ = _proportional_alloc(n_agents, df_occupation["totalestimate"].values.astype(float))
        n_inc = _proportional_alloc(n_agents, df_income["estimated"].values.astype(float))
        ages = np.array(np.repeat(cat_age, n_age).tolist())
        races = np.array(np.repeat(cat_race, n_race).tolist())
        occs = np.array(np.repeat(cat_occ, n_occ).tolist())
        incs = np.array(np.repeat(cat_inc, n_inc).tolist())
        rng.shuffle(ages)
        rng.shuffle(races)
        rng.shuffle(occs)
        rng.shuffle(incs)
        rows = [
            {
                "agent_id": i + 1,
                "age": ages[i],
                "race": races[i],
                "income": incs[i],
                "occupation": occs[i],
            }
            for i in range(n_agents)
        ]
    else:
        p_age = _normalize_to_probs(df_age["count"].values)
        p_race = _normalize_to_probs(df_race["value"].values)
        p_occ = _normalize_to_probs(df_occupation["totalestimate"].values)
        p_inc = _normalize_to_probs(df_income["estimated"].values)
        rows = [
            {
                "agent_id": i + 1,
                "age": rng.choice(cat_age, p=p_age),
                "race": rng.choice(cat_race, p=p_race),
                "income": rng.choice(cat_inc, p=p_inc),
                "occupation": rng.choice(cat_occ, p=p_occ),
            }
            for i in range(n_agents)
        ]

    return pd.DataFrame(rows)[["agent_id", "age", "race", "income", "occupation"]]


def check_representativeness(
    location: str,
    sample_df: pd.DataFrame,
    population_dfs: tuple | None = None,
) -> dict:
    """Compare a sample to the population distribution for the location."""
    if population_dfs is None:
        population_dfs = load_distributions(location)
    df_age, df_race, df_occupation, df_income = population_dfs
    n = len(sample_df)

    def report(sample_col: str, df_pop: pd.DataFrame, value_col: str) -> pd.DataFrame:
        pop_pct = _normalize_to_probs(df_pop[value_col].values) * 100
        counts = sample_df[sample_col].value_counts()
        sample_pct = np.zeros(len(df_pop))
        for i, cat in enumerate(df_pop["category"].values):
            sample_pct[i] = counts.get(cat, 0) / n * 100
        return pd.DataFrame(
            {
                "category": df_pop["category"].values,
                "pop_pct": np.round(pop_pct, 1),
                "sample_count": [int(counts.get(c, 0)) for c in df_pop["category"].values],
                "sample_pct": np.round(sample_pct, 1),
            }
        )

    return {
        "age": report("age", df_age, "count"),
        "race": report("race", df_race, "value"),
        "occupation": report("occupation", df_occupation, "totalestimate"),
        "income": report("income", df_income, "estimated"),
    }


def format_representativeness_report(report: dict, n_agents: int) -> str:
    """Format a representativeness report as a human-readable string."""
    lines = [
        "",
        "=" * 60,
        f"Representativeness check (population vs. sample of n={n_agents})",
        "Pop % = population share; Sample % = share among generated agents.",
        "=" * 60,
    ]
    for variable in ["age", "race", "occupation", "income"]:
        df = report[variable]
        lines.append(f"\n--- {variable.upper()} ---")
        lines.append(df.to_string(index=False))
    lines.append("")
    return "\n".join(lines)
