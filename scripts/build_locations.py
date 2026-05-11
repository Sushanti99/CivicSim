#!/usr/bin/env python3
"""Build per-location demographic CSVs for the agent generator.

Each location ends up as four small CSVs in ``data/locations/<id>/``:

    age.csv         (category, count)
    race.csv        (category, value)
    occupation.csv  (category, totalestimate)
    income.csv      (category, estimated)

Schema mirrors the original Alameda CSVs so ``civicsim_agents.sample_agents``
works without changes.

Two modes:

* ``--synthetic`` (default if no ``--source`` given): emits 4 regions + 9
  divisions + Alameda with plausibly-shaped distributions seeded off the
  Alameda template. Works offline, no AWS needed. Sufficient for demos.

* Real mode: reads ``acs_{year}_harmonized.parquet`` from S3 (private),
  groups by ``F_CREGION`` / ``F_CDIVISION``, and writes real counts.

Region / division names match the Pew ATP vocabulary so the ATP priors
parquet (also keyed by ``F_CREGION`` / ``F_CDIVISION``) joins cleanly.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd

logger = logging.getLogger("build_locations")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


REGIONS = ["Northeast", "Midwest", "South", "West"]

DIVISIONS = [
    ("New England", "Northeast"),
    ("Middle Atlantic", "Northeast"),
    ("East North Central", "Midwest"),
    ("West North Central", "Midwest"),
    ("South Atlantic", "South"),
    ("East South Central", "South"),
    ("West South Central", "South"),
    ("Mountain", "West"),
    ("Pacific", "West"),
]

# Rough approximate populations per region (millions).
REGION_POPULATIONS = {
    "Northeast": 55_700_000,
    "Midwest": 68_900_000,
    "South": 128_700_000,
    "West": 78_900_000,
}

DIVISION_POPULATIONS = {
    "New England": 15_100_000,
    "Middle Atlantic": 40_600_000,
    "East North Central": 46_900_000,
    "West North Central": 22_000_000,
    "South Atlantic": 67_800_000,
    "East South Central": 19_300_000,
    "West South Central": 41_600_000,
    "Mountain": 25_000_000,
    "Pacific": 53_900_000,
}


def slugify(name: str, prefix: str) -> str:
    return f"{prefix}_" + name.lower().replace(" ", "_").replace("-", "_")


# Tilt multipliers per region. These are intentionally modest deviations from a
# "national baseline" derived from the Alameda CSVs (whose absolute counts get
# rescaled to each region's population). They produce demographically distinct
# but plausible sample populations so the demo feels real.
#
# Keys are category strings as they appear in the bundled Alameda CSVs.
REGION_TILTS = {
    "Northeast": {
        "age": {"30 to 34 years": 1.05, "70 to 74 years": 1.10, "75 to 79 years": 1.15},
        "race": {
            "White alone": 1.10,
            "Black or African American alone": 1.05,
            "Asian alone": 0.85,
        },
        "income": {
            "$100,000 to $149,999": 1.05,
            "$150,000 to $199,999": 1.10,
            "$200,000 or more": 1.05,
        },
    },
    "Midwest": {
        "age": {"55 to 59 years": 1.08, "60 to 64 years": 1.10, "65 to 69 years": 1.08},
        "race": {
            "White alone": 1.25,
            "Black or African American alone": 0.90,
            "Asian alone": 0.55,
            "Some Other Race alone": 0.70,
        },
        "income": {
            "$50,000 to $74,999": 1.20,
            "$75,000 to $99,999": 1.10,
            "$200,000 or more": 0.55,
        },
    },
    "South": {
        "age": {"25 to 29 years": 1.05, "30 to 34 years": 1.05, "35 to 39 years": 1.05},
        "race": {
            "White alone": 1.05,
            "Black or African American alone": 1.55,
            "Asian alone": 0.65,
        },
        "income": {
            "Less than $10,000": 1.15,
            "$25,000 to $34,999": 1.20,
            "$200,000 or more": 0.65,
        },
    },
    "West": {
        "age": {"20 to 24 years": 1.05, "25 to 29 years": 1.10, "30 to 34 years": 1.05},
        "race": {
            "White alone": 0.85,
            "Asian alone": 1.30,
            "Some Other Race alone": 1.45,
            "Native Hawaiian and Other Pacific Islander alone": 1.50,
        },
        "income": {
            "$150,000 to $199,999": 1.15,
            "$200,000 or more": 1.20,
        },
    },
}


def _load_template() -> dict[str, pd.DataFrame]:
    """Load Alameda CSVs as the national-baseline template."""
    base = Path(__file__).resolve().parents[1] / "data" / "locations" / "alameda_california"
    return {
        "age": pd.read_csv(base / "age.csv"),
        "race": pd.read_csv(base / "race.csv"),
        "occupation": pd.read_csv(base / "occupation.csv"),
        "income": pd.read_csv(base / "income.csv"),
    }


def _apply_tilt(df: pd.DataFrame, value_col: str, tilt: dict[str, float]) -> pd.DataFrame:
    df = df.copy()
    df[value_col] = df.apply(
        lambda row: row[value_col] * tilt.get(row["category"], 1.0), axis=1
    )
    return df


def _scale_to_population(df: pd.DataFrame, value_col: str, target_pop: int) -> pd.DataFrame:
    df = df.copy()
    total = df[value_col].sum()
    if total <= 0:
        return df
    df[value_col] = (df[value_col] / total) * target_pop
    if value_col == "estimated":  # income column is a percent in the template
        df[value_col] = (df[value_col] / df[value_col].sum()) * 100
    return df


def _round(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    df = df.copy()
    if value_col == "estimated":
        df[value_col] = df[value_col].round(1)
    else:
        df[value_col] = df[value_col].round().astype(int)
    return df


def _build_one(
    out_dir: Path,
    template: dict[str, pd.DataFrame],
    *,
    tilt_key: str | None,
    target_pop: int,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    tilts = REGION_TILTS.get(tilt_key, {}) if tilt_key else {}

    age = _apply_tilt(template["age"], "count", tilts.get("age", {}))
    age = _round(_scale_to_population(age, "count", target_pop), "count")
    age.to_csv(out_dir / "age.csv", index=False)

    race = _apply_tilt(template["race"], "value", tilts.get("race", {}))
    race = _round(_scale_to_population(race, "value", target_pop), "value")
    race.to_csv(out_dir / "race.csv", index=False)

    income = _apply_tilt(template["income"], "estimated", tilts.get("income", {}))
    income = _round(_scale_to_population(income, "estimated", target_pop), "estimated")
    income.to_csv(out_dir / "income.csv", index=False)

    # Occupation: scale only, no tilt for now (too many categories to hand-tune).
    occ = _scale_to_population(template["occupation"], "totalestimate", target_pop // 2)
    occ = _round(occ, "totalestimate")
    occ.to_csv(out_dir / "occupation.csv", index=False)


def build_synthetic(repo_root: Path) -> list[dict]:
    template = _load_template()
    out_base = repo_root / "data" / "locations"
    catalog: list[dict] = []

    # 4 regions
    for region in REGIONS:
        loc_id = slugify(region, "region")
        _build_one(
            out_base / loc_id, template,
            tilt_key=region, target_pop=REGION_POPULATIONS[region],
        )
        catalog.append({
            "id": loc_id, "label": f"{region} (region)", "kind": "region",
            "region": region, "division": None,
            "population": REGION_POPULATIONS[region],
        })

    # 9 divisions — borrow parent-region tilts so they're internally consistent.
    for division, parent_region in DIVISIONS:
        loc_id = slugify(division, "division")
        _build_one(
            out_base / loc_id, template,
            tilt_key=parent_region, target_pop=DIVISION_POPULATIONS[division],
        )
        catalog.append({
            "id": loc_id, "label": f"{division} ({parent_region})", "kind": "division",
            "region": parent_region, "division": division,
            "population": DIVISION_POPULATIONS[division],
        })

    return catalog


def build_from_acs(source_uri: str, repo_root: Path) -> list[dict]:
    """Aggregate the private harmonized ACS parquet by region and division.

    Output is *demographic-count* CSVs in the same schema as the bundled
    Alameda template. Numbers reflect weighted ACS estimates per region.
    """
    import duckdb

    con = duckdb.connect(":memory:")
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET s3_region='us-east-1';")

    out_base = repo_root / "data" / "locations"
    catalog: list[dict] = []

    # We need ATP-style bins to match the priors parquet. The harmonized ACS
    # parquet has those columns already.
    for kind, group_col, names in (
        ("region", "F_CREGION", REGIONS),
        ("division", "F_CDIVISION", [d for d, _ in DIVISIONS]),
    ):
        for name in names:
            loc_id = slugify(name, kind)
            out_dir = out_base / loc_id
            out_dir.mkdir(parents=True, exist_ok=True)

            age_df = con.execute(
                f"""SELECT age_group AS category, SUM(PERWT)::BIGINT AS count
                    FROM read_parquet('{source_uri}')
                    WHERE {group_col} = ? GROUP BY ALL ORDER BY age_group""",
                [name],
            ).df()
            age_df.to_csv(out_dir / "age.csv", index=False)

            race_df = con.execute(
                f"""SELECT race_eth AS category, SUM(PERWT)::BIGINT AS value
                    FROM read_parquet('{source_uri}')
                    WHERE {group_col} = ? GROUP BY ALL ORDER BY race_eth""",
                [name],
            ).df()
            race_df.to_csv(out_dir / "race.csv", index=False)

            inc_df = con.execute(
                f"""SELECT income_group AS category,
                           (SUM(PERWT) / NULLIF((SELECT SUM(PERWT)
                                                 FROM read_parquet('{source_uri}')
                                                 WHERE {group_col} = ?), 0) * 100) AS estimated
                    FROM read_parquet('{source_uri}')
                    WHERE {group_col} = ? GROUP BY ALL ORDER BY income_group""",
                [name, name],
            ).df()
            inc_df["estimated"] = inc_df["estimated"].round(1)
            inc_df.to_csv(out_dir / "income.csv", index=False)

            # We don't have occupation in the harmonized ACS extract; reuse the
            # national-proportion fallback from the synthetic builder so the
            # agent generator has something to sample.
            template = _load_template()
            pop = int(age_df["count"].sum())
            occ = _scale_to_population(template["occupation"], "totalestimate", pop // 2)
            _round(occ, "totalestimate").to_csv(out_dir / "occupation.csv", index=False)

            catalog.append({
                "id": loc_id,
                "label": f"{name} ({'region' if kind == 'region' else 'division'})",
                "kind": kind,
                "region": name if kind == "region" else None,
                "division": name if kind == "division" else None,
                "population": pop,
            })

    return catalog


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="ACS harmonized parquet URI (real mode).")
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--out-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args(argv)

    if args.synthetic or not args.source:
        if not args.synthetic:
            logger.warning("No --source provided; falling back to --synthetic")
        catalog = build_synthetic(args.out_root)
    else:
        catalog = build_from_acs(args.source, args.out_root)

    # Write a catalog index for the API to enumerate.
    catalog_path = args.out_root / "data" / "locations" / "_catalog.json"
    import json

    catalog_path.write_text(json.dumps(catalog, indent=2))
    logger.info("Wrote %s locations + catalog at %s", len(catalog), catalog_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
