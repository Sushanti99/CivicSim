#!/usr/bin/env python3
"""Build a compact ATP-derived opinion-prior parquet for the public demo.

Reads the private merged ATP parquet (e.g. on S3) and writes a small lookup
parquet at ``data/atp_priors/policy_priors.parquet``. The output keeps only:

* a curated subset of policy ``question_id``s (see ``QUESTION_ALLOWLIST``);
* per-question, per-demographic-cell answer-share distributions;
* a fully-marginal ('ALL' on every dim) row per question for fallback;
* human-readable ``question_label`` and ``answer_label`` columns from the ATP
  label tables.

Run privately (with AWS creds) once per ATP refresh; commit the resulting
small parquet. The public repo never has to see the raw ATP data.

Usage::

    python scripts/build_atp_priors.py \
        --source s3://civicsim-data/parquet/atp_2021_2024_final.parquet \
        --question-labels s3://civicsim-data/parquet/atp_2021_question_labels.parquet \
        --answer-labels   s3://civicsim-data/parquet/atp_2021_answer_labels.parquet \
        --out data/atp_priors/policy_priors.parquet

If ``--source`` is omitted, ``--synthetic`` produces a small fake parquet so
the demo still works without access to the private data.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import duckdb
import pandas as pd

logger = logging.getLogger("build_atp_priors")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


QUESTION_ALLOWLIST: list[tuple[str, str]] = [
    # (question_id, human_readable_label_override_if_needed)
    ("POL1", ""),
    ("POL10", ""),
    ("ECON1MOD", ""),
    ("SATIS", ""),
    ("CLIM1", ""),
    ("GUN1", ""),
    ("IMMVAL_a", ""),
    ("ABORTION", ""),
    ("HLTHCARE1", ""),
    ("EDUC1", ""),
]


DIMS = ["age_group", "gender", "race_eth", "education_group", "income_group", "urbanicity"]
MARGINAL = "ALL"


SYNTHETIC_QUESTIONS: list[dict] = [
    {
        "question_id": "Q_CLIMATE",
        "question_label": "Should the federal government do more to address climate change?",
        "answers": ["Yes, much more", "Yes, somewhat more", "No, current efforts are adequate", "No, less"],
    },
    {
        "question_id": "Q_HOUSING",
        "question_label": "Should local government build more affordable housing in your neighborhood?",
        "answers": ["Strongly support", "Somewhat support", "Somewhat oppose", "Strongly oppose"],
    },
    {
        "question_id": "Q_TRANSIT",
        "question_label": "Would you support raising local taxes to fund expanded public transit?",
        "answers": ["Yes", "No", "Not sure"],
    },
    {
        "question_id": "Q_GUNS",
        "question_label": "Should there be stricter laws on firearm purchases?",
        "answers": ["Yes, much stricter", "Yes, somewhat stricter", "Keep as is", "Less strict"],
    },
    {
        "question_id": "Q_HEALTHCARE",
        "question_label": "Should the U.S. move toward a single-payer healthcare system?",
        "answers": ["Strongly favor", "Somewhat favor", "Somewhat oppose", "Strongly oppose"],
    },
    {
        "question_id": "Q_EDUCATION",
        "question_label": "Should public colleges be tuition-free for state residents?",
        "answers": ["Yes", "No", "Only for low-income families"],
    },
    {
        "question_id": "Q_MINWAGE",
        "question_label": "Should the federal minimum wage be raised to $15/hour?",
        "answers": ["Yes", "No", "Yes, but phased in"],
    },
    {
        "question_id": "Q_IMMIGRATION",
        "question_label": "Should the U.S. expand legal immigration?",
        "answers": ["Yes, significantly", "Yes, modestly", "Keep current levels", "Reduce levels"],
    },
]


CELLS = {
    "age_group": ["18-29", "30-49", "50-64", "65+", "under_18"],
    "gender": ["man", "woman"],
    "race_eth": ["White", "Black or African-American", "Asian or Asian-American", "Other"],
    "education_group": ["hs_or_less", "some_college", "college_graduate_plus"],
    "income_group": [
        "below_30000", "30000_to_40000", "40000_to_50000",
        "50000_to_75000", "75000_to_100000", "above_100000",
    ],
    "urbanicity": ["urban", "rural"],
}


def build_real(
    *,
    source_uri: str,
    q_labels_uri: str,
    a_labels_uri: str,
    out: Path,
) -> None:
    """Compile a small lookup parquet from the private merged ATP data."""
    qid_list = ", ".join(f"'{q}'" for q, _ in QUESTION_ALLOWLIST)
    con = duckdb.connect(":memory:")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-east-1';")

    logger.info("Reading source: %s", source_uri)

    # Per-cell distribution
    cell_sql = f"""
        WITH base AS (
            SELECT
                question_code AS question_id,
                CAST(answer_code AS VARCHAR) AS answer_code,
                COALESCE(F_AGECAT, age_group, 'ALL') AS age_group,
                COALESCE(gender, 'ALL') AS gender,
                COALESCE(race_eth, 'ALL') AS race_eth,
                COALESCE(education_group, 'ALL') AS education_group,
                COALESCE(income_group, 'ALL') AS income_group,
                COALESCE(urbanicity, 'ALL') AS urbanicity,
                WEIGHT
            FROM read_parquet('{source_uri}')
            WHERE question_code IN ({qid_list})
                  AND answer_code IS NOT NULL
        ), per_cell AS (
            SELECT question_id, age_group, gender, race_eth, education_group,
                   income_group, urbanicity, answer_code, SUM(WEIGHT) AS w
            FROM base
            GROUP BY ALL
        ), totals AS (
            SELECT question_id, age_group, gender, race_eth, education_group,
                   income_group, urbanicity, SUM(w) AS total_w
            FROM per_cell
            GROUP BY ALL
        )
        SELECT pc.question_id,
               pc.age_group, pc.gender, pc.race_eth, pc.education_group,
               pc.income_group, pc.urbanicity,
               pc.answer_code,
               pc.w / t.total_w AS prob
        FROM per_cell pc
        JOIN totals t USING (question_id, age_group, gender, race_eth,
                             education_group, income_group, urbanicity)
        WHERE t.total_w >= 30   -- ignore very sparse cells
    """
    cell_df = con.execute(cell_sql).df()
    logger.info("Per-cell rows: %s", len(cell_df))

    # Fully-marginal distribution (per question, ALL on every dim)
    marg_sql = f"""
        SELECT
            question_code AS question_id,
            'ALL' AS age_group, 'ALL' AS gender, 'ALL' AS race_eth,
            'ALL' AS education_group, 'ALL' AS income_group, 'ALL' AS urbanicity,
            CAST(answer_code AS VARCHAR) AS answer_code,
            SUM(WEIGHT) / (SELECT SUM(WEIGHT)
                           FROM read_parquet('{source_uri}')
                           WHERE question_code = base.question_code
                                 AND answer_code IS NOT NULL) AS prob
        FROM read_parquet('{source_uri}') AS base
        WHERE question_code IN ({qid_list}) AND answer_code IS NOT NULL
        GROUP BY question_code, answer_code
    """
    marg_df = con.execute(marg_sql).df()
    logger.info("Marginal rows: %s", len(marg_df))

    full = pd.concat([cell_df, marg_df], ignore_index=True)

    # Attach human-readable labels.
    q_labels = pd.read_parquet(q_labels_uri).rename(columns={"question_code": "question_id"})
    a_labels = pd.read_parquet(a_labels_uri).rename(columns={"question_code": "question_id"})
    a_labels["answer_code"] = a_labels["answer_code"].astype(str)

    full = full.merge(q_labels, on="question_id", how="left")
    full = full.merge(a_labels, on=["question_id", "answer_code"], how="left")
    full["question_label"] = full["question_label"].fillna(full["question_id"])
    full["answer_label"] = full["answer_label"].fillna(full["answer_code"])

    cols = [
        "question_id", "question_label",
        *DIMS,
        "answer_label", "prob",
    ]
    full = full[cols]
    out.parent.mkdir(parents=True, exist_ok=True)
    full.to_parquet(out, index=False)
    logger.info("Wrote %s rows to %s (%.1f KB)", len(full), out, out.stat().st_size / 1024)


def build_synthetic(out: Path, *, seed: int = 0) -> None:
    """Fabricate a small but plausibly-shaped priors parquet for offline demos."""
    import numpy as np

    rng = np.random.default_rng(seed)
    rows: list[dict] = []

    for q in SYNTHETIC_QUESTIONS:
        qid = q["question_id"]
        qlabel = q["question_label"]
        answers = q["answers"]
        # Choose a "national baseline" centered Dirichlet to keep things plausible.
        baseline = rng.dirichlet([2.0] * len(answers))

        # Marginal row.
        for ans, p in zip(answers, baseline, strict=False):
            rows.append({
                "question_id": qid, "question_label": qlabel,
                "age_group": MARGINAL, "gender": MARGINAL, "race_eth": MARGINAL,
                "education_group": MARGINAL, "income_group": MARGINAL, "urbanicity": MARGINAL,
                "answer_label": ans, "prob": float(p),
            })

        # Per-cell perturbations: vary one dimension at a time (single-dim cells).
        for dim, values in CELLS.items():
            for v in values:
                # Random tilt of the baseline by a small Dirichlet prior.
                tilt = rng.dirichlet(baseline * 20 + 0.5)
                for ans, p in zip(answers, tilt, strict=False):
                    cell = {d: MARGINAL for d in DIMS}
                    cell[dim] = v
                    rows.append({
                        "question_id": qid, "question_label": qlabel,
                        **cell,
                        "answer_label": ans, "prob": float(p),
                    })

        # A handful of two-dim cells (age x race) so backoff has something to hit.
        for ag in CELLS["age_group"][:4]:
            for rc in CELLS["race_eth"]:
                tilt = rng.dirichlet(baseline * 25 + 0.5)
                for ans, p in zip(answers, tilt, strict=False):
                    cell = {d: MARGINAL for d in DIMS}
                    cell["age_group"] = ag
                    cell["race_eth"] = rc
                    rows.append({
                        "question_id": qid, "question_label": qlabel,
                        **cell,
                        "answer_label": ans, "prob": float(p),
                    })

    df = pd.DataFrame(rows)[["question_id", "question_label", *DIMS, "answer_label", "prob"]]
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    size_kb = out.stat().st_size / 1024
    logger.info(
        "Wrote synthetic priors: %s questions, %s rows, %.1f KB at %s",
        df["question_id"].nunique(), len(df), size_kb, out,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="Path/URI to merged ATP parquet (private).")
    parser.add_argument("--question-labels", help="Path/URI to question-labels parquet.")
    parser.add_argument("--answer-labels", help="Path/URI to answer-labels parquet.")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/atp_priors/policy_priors.parquet"),
        help="Output parquet path (relative to repo root).",
    )
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="Build a synthetic, schema-correct lookup (no AWS / no private data).",
    )
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)

    if args.synthetic or not args.source:
        if not args.synthetic:
            logger.warning("No --source provided; falling back to --synthetic")
        build_synthetic(args.out, seed=args.seed)
        return 0

    missing = [
        name for name, val in (
            ("--question-labels", args.question_labels),
            ("--answer-labels", args.answer_labels),
        ) if not val
    ]
    if missing:
        parser.error(f"Real build requires: {', '.join(missing)}")

    build_real(
        source_uri=args.source,
        q_labels_uri=args.question_labels,
        a_labels_uri=args.answer_labels,
        out=args.out,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
