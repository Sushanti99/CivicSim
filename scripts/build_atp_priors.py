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


DIMS = [
    "F_CREGION",
    "F_CDIVISION",
    "age_group",
    "gender",
    "race_eth",
    "education_group",
    "income_group",
    "urbanicity",
]
MARGINAL = "ALL"

REGIONS = ["Northeast", "Midwest", "South", "West"]
DIVISIONS_BY_REGION = {
    "Northeast": ["New England", "Middle Atlantic"],
    "Midwest": ["East North Central", "West North Central"],
    "South": ["South Atlantic", "East South Central", "West South Central"],
    "West": ["Mountain", "Pacific"],
}


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


# Modest per-region answer-share tilts applied on top of the national baseline.
# These are intentionally hand-tuned, not derived from real ATP — they make the
# synthetic priors regionally distinct so the UI shows real variation when the
# user changes location. The real builder pulls these from ATP weighted shares.
REGION_PRIOR_TILTS = {
    "Northeast": 1.2,
    "Midwest": 1.0,
    "South": 0.85,
    "West": 1.3,
}


def build_real(
    *,
    source_uri: str,
    q_labels_uri: str,
    a_labels_uri: str,
    out: Path,
) -> None:
    """Compile a small lookup parquet from the private merged ATP data.

    Emits three groups of rows per question:

    1. Per-region (F_CREGION) + per-division (F_CDIVISION) marginals.
    2. Per-demographic-cell rows (age x ... x urbanicity), national.
    3. Fully-marginal national fallback row.
    """
    qid_list = ", ".join(f"'{q}'" for q, _ in QUESTION_ALLOWLIST)
    con = duckdb.connect(":memory:")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-east-1';")
    logger.info("Reading source: %s", source_uri)

    base_sql = f"""
        SELECT
            question_code AS question_id,
            CAST(answer_code AS VARCHAR) AS answer_code,
            COALESCE(F_CREGION, 'ALL') AS F_CREGION,
            COALESCE(F_CDIVISION, 'ALL') AS F_CDIVISION,
            COALESCE(age_group, F_AGECAT, 'ALL') AS age_group,
            COALESCE(gender, 'ALL') AS gender,
            COALESCE(race_eth, 'ALL') AS race_eth,
            COALESCE(education_group, 'ALL') AS education_group,
            COALESCE(income_group, 'ALL') AS income_group,
            COALESCE(urbanicity, 'ALL') AS urbanicity,
            WEIGHT
        FROM read_parquet('{source_uri}')
        WHERE question_code IN ({qid_list})
              AND answer_code IS NOT NULL
    """
    con.execute(f"CREATE TEMP VIEW base AS {base_sql}")

    def _share(group_cols: list[str], where: str = "1=1") -> pd.DataFrame:
        cols_sql = ", ".join(group_cols)
        sql = f"""
            WITH a AS (
                SELECT {cols_sql}, answer_code, SUM(WEIGHT) AS w
                FROM base WHERE {where} GROUP BY ALL
            ), t AS (
                SELECT {cols_sql}, SUM(w) AS total_w FROM a GROUP BY ALL
            )
            SELECT a.*, a.w / t.total_w AS prob
            FROM a JOIN t USING ({cols_sql})
            WHERE t.total_w >= 30
        """
        return con.execute(sql).df()

    # Demographic cells, national.
    cell_df = _share(
        ["question_id", "age_group", "gender", "race_eth",
         "education_group", "income_group", "urbanicity"],
    )
    cell_df["F_CREGION"] = MARGINAL
    cell_df["F_CDIVISION"] = MARGINAL

    # Per-region marginal.
    region_df = _share(["question_id", "F_CREGION"], where="F_CREGION <> 'ALL'")
    for d in ["F_CDIVISION", "age_group", "gender", "race_eth",
              "education_group", "income_group", "urbanicity"]:
        region_df[d] = MARGINAL

    # Per-division marginal.
    div_df = _share(["question_id", "F_CREGION", "F_CDIVISION"],
                    where="F_CDIVISION <> 'ALL'")
    for d in ["age_group", "gender", "race_eth",
              "education_group", "income_group", "urbanicity"]:
        div_df[d] = MARGINAL

    # National marginal.
    marg_df = _share(["question_id"])
    for d in DIMS:
        marg_df[d] = MARGINAL

    full = pd.concat([region_df, div_df, cell_df, marg_df], ignore_index=True)
    logger.info(
        "Rows: region=%s, division=%s, demographic_cell=%s, national=%s",
        len(region_df), len(div_df), len(cell_df), len(marg_df),
    )

    # Attach human-readable labels.
    q_labels = pd.read_parquet(q_labels_uri).rename(columns={"question_code": "question_id"})
    a_labels = pd.read_parquet(a_labels_uri).rename(columns={"question_code": "question_id"})
    a_labels["answer_code"] = a_labels["answer_code"].astype(str)
    full = full.merge(q_labels, on="question_id", how="left")
    full = full.merge(a_labels, on=["question_id", "answer_code"], how="left")
    full["question_label"] = full["question_label"].fillna(full["question_id"])
    full["answer_label"] = full["answer_label"].fillna(full["answer_code"])

    full = full[["question_id", "question_label", *DIMS, "answer_label", "prob"]]
    out.parent.mkdir(parents=True, exist_ok=True)
    full.to_parquet(out, index=False)
    logger.info("Wrote %s rows to %s (%.1f KB)", len(full), out, out.stat().st_size / 1024)


def build_synthetic(out: Path, *, seed: int = 0) -> None:
    """Fabricate a small but plausibly-shaped priors parquet for offline demos.

    Emits, per question, the following row groups (each row group sums to 1):

    1. National marginal (every dim = 'ALL').
    2. One row group per region (F_CREGION = R, everything else 'ALL').
    3. One row group per division (F_CDIVISION = D, everything else 'ALL').
    4. Single-demographic-dim cells under the national marginal (age x ALL, etc.).
    5. (age x race) two-dim cells under the national marginal — keeps backoff
       interesting without exploding the file size.
    """
    import numpy as np

    rng = np.random.default_rng(seed)
    rows: list[dict] = []

    def _emit(qid: str, qlabel: str, answers: list[str], probs, **cell_overrides):
        cell = {d: MARGINAL for d in DIMS}
        cell.update(cell_overrides)
        # Normalize.
        probs = np.asarray(probs, dtype=float)
        probs = probs / probs.sum()
        for ans, p in zip(answers, probs, strict=True):
            rows.append({
                "question_id": qid, "question_label": qlabel,
                **cell,
                "answer_label": ans, "prob": float(p),
            })

    def _tilt(baseline: np.ndarray, strength: float) -> np.ndarray:
        return rng.dirichlet(baseline * strength + 0.5)

    for q in SYNTHETIC_QUESTIONS:
        qid = q["question_id"]
        qlabel = q["question_label"]
        answers = q["answers"]

        baseline = rng.dirichlet([2.0] * len(answers))
        _emit(qid, qlabel, answers, baseline)  # national marginal

        # 1 row group per region with a region-specific tilt.
        region_baselines: dict[str, np.ndarray] = {}
        for region, scale in REGION_PRIOR_TILTS.items():
            r = _tilt(baseline, 15.0 * scale)
            region_baselines[region] = r
            _emit(qid, qlabel, answers, r, F_CREGION=region)

        # 1 row group per division — tilt off the parent region.
        for region, divisions in DIVISIONS_BY_REGION.items():
            for division in divisions:
                d = _tilt(region_baselines[region], 35.0)
                _emit(qid, qlabel, answers, d, F_CREGION=region, F_CDIVISION=division)

        # Per-demographic-dim cells under national marginal.
        for dim, values in CELLS.items():
            for v in values:
                _emit(qid, qlabel, answers, _tilt(baseline, 20.0), **{dim: v})

        # (age x race) two-dim cells under national marginal.
        for ag in CELLS["age_group"][:4]:
            for rc in CELLS["race_eth"]:
                _emit(qid, qlabel, answers, _tilt(baseline, 25.0),
                      age_group=ag, race_eth=rc)

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
