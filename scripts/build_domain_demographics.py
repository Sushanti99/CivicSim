"""Build data/atp_priors/domain_demographics.json.

For each domain (from Experiment 2), ranks demographic dimensions by
information gain (KL divergence) and notes whether geographic conditioning
is required (from Experiment 3 Jensen-Shannon analysis).

Usage
-----
  # from real Experiment 2/3 CSVs (private paths):
  python scripts/build_domain_demographics.py \\
      --ig  /path/to/ig_single_by_domain.csv \\
      --geo /path/to/js_by_domain.csv

  # synthetic fallback (no external data needed):
  python scripts/build_domain_demographics.py --synthetic
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT_PATH = ROOT / "data" / "atp_priors" / "domain_demographics.json"

# Map Experiment-2 demographic names → (ATP column, display label)
_DIM_MAP: dict[str, tuple[str, str]] = {
    "age":       ("age_group",       "Age"),
    "education": ("education_group", "Education"),
    "gender":    ("gender",          "Gender"),
    "income":    ("income_group",    "Income"),
    "location":  ("F_CREGION",      "Region"),
    "metro":     ("urbanicity",      "Urbanicity"),
    "race":      ("race_eth",        "Race / Ethnicity"),
}

# Experiment-3 decision → needs_geo bool + note for the UI
_GEO_DECISION: dict[str, tuple[bool, str]] = {
    "not_needed": (False, "Geography adds minimal signal for this domain."),
    "optional":   (False, "Geography adds modest signal; included if user selects a region."),
    "required":   (True,  "Cross-geography differences are significant; region strongly recommended."),
}

_DOMAIN_META: dict[str, dict] = {
    "economy":             {"label": "Economy",                "description": "Economy, jobs, income, inflation, taxes, personal finance."},
    "environment_climate": {"label": "Environment & Climate",  "description": "Climate change, environment, energy, pollution, extreme weather."},
    "family_society":      {"label": "Family & Society",       "description": "Family, children, marriage, gender, LGBT, abortion, education."},
    "health":              {"label": "Health",                 "description": "Health, healthcare, COVID, mental health, medical topics."},
    "immigration":         {"label": "Immigration",            "description": "Immigrants, border, asylum, citizenship policy."},
    "international":       {"label": "International Affairs",  "description": "Foreign countries, foreign policy, military, war, global affairs."},
    "politics_gov":        {"label": "Politics & Government",  "description": "Federal government, Congress, elections, parties, democracy."},
    "race_inequality":     {"label": "Race & Inequality",      "description": "Race, ethnicity, racial discrimination, and racial inequality."},
    "religion":            {"label": "Religion",               "description": "Religion, faith, religious practice, religious identity."},
    "technology":          {"label": "Technology & Media",     "description": "Technology, social media, news media, AI, internet, online platforms."},
}

# Which curated ATP questions map to each domain (codes match atp_2021_final.parquet)
_DOMAIN_QUESTIONS: dict[str, list[str]] = {
    "economy":             ["MINWAGE_W87", "INFRASTRUC21A_W95", "ECON1_W84"],
    "environment_climate": ["CLIM9_W89"],
    "family_society":      ["ABORTLGL_W87"],
    "health":              [],
    "immigration":         ["AFG21_2_W95"],
    "international":       [],
    "politics_gov":        ["GUNPRIORITY1_c_W87", "POL1JB_W92", "SATIS_W95", "GAP21Q3_W82"],
    "race_inequality":     [],
    "religion":            [],
    "technology":          [],
}

# Number of dimensions auto-selected (highest KL)
_AUTO_SELECT_TOP_N = 3

# Synthetic IG values — plausible orderings used when real data is unavailable
_SYNTHETIC_IG: dict[str, dict[str, float]] = {
    "economy":             {"income": 0.024, "age": 0.017, "race": 0.016, "location": 0.014, "education": 0.012, "gender": 0.006, "metro": 0.003},
    "environment_climate": {"race": 0.014, "income": 0.012, "location": 0.012, "age": 0.011, "education": 0.008, "gender": 0.007, "metro": 0.004},
    "family_society":      {"income": 0.021, "age": 0.018, "location": 0.016, "education": 0.015, "race": 0.014, "gender": 0.009, "metro": 0.003},
    "health":              {"income": 0.018, "race": 0.015, "age": 0.012, "location": 0.012, "education": 0.010, "gender": 0.004, "metro": 0.003},
    "immigration":         {"age": 0.023, "race": 0.019, "income": 0.014, "location": 0.011, "education": 0.010, "gender": 0.005, "metro": 0.003},
    "international":       {"age": 0.023, "income": 0.020, "race": 0.016, "location": 0.013, "education": 0.012, "gender": 0.012, "metro": 0.003},
    "politics_gov":        {"race": 0.020, "age": 0.017, "income": 0.016, "location": 0.013, "education": 0.011, "gender": 0.006, "metro": 0.003},
    "race_inequality":     {"race": 0.018, "income": 0.017, "location": 0.013, "age": 0.011, "education": 0.010, "gender": 0.006, "metro": 0.003},
    "religion":            {"age": 0.013, "income": 0.013, "location": 0.012, "education": 0.009, "race": 0.012, "gender": 0.005, "metro": 0.003},
    "technology":          {"age": 0.019, "income": 0.018, "location": 0.013, "race": 0.014, "education": 0.011, "gender": 0.006, "metro": 0.002},
}

_SYNTHETIC_GEO: dict[str, str] = {
    "technology":          "not_needed",
    "environment_climate": "not_needed",
    "health":              "optional",
    "family_society":      "optional",
    "economy":             "optional",
    "religion":            "optional",
    "politics_gov":        "optional",
    "race_inequality":     "optional",
    "immigration":         "optional",
    "international":       "required",
}


def _load_ig(ig_csv: Path) -> dict[str, dict[str, float]]:
    result: dict[str, dict[str, float]] = {}
    with ig_csv.open() as f:
        for row in csv.DictReader(f):
            domain = row["domain"]
            dim = row["demographic"]
            ig = float(row["mean_IG"])
            result.setdefault(domain, {})[dim] = ig
    return result


def _load_geo(geo_csv: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    with geo_csv.open() as f:
        for row in csv.DictReader(f):
            result[row["domain"]] = row["decision"]
    return result


def build(ig_data: dict[str, dict[str, float]], geo_data: dict[str, str]) -> dict:
    out: dict[str, dict] = {}
    for domain, meta in _DOMAIN_META.items():
        igs = ig_data.get(domain, {})
        decision = geo_data.get(domain, "optional")
        needs_geo, geo_note = _GEO_DECISION.get(decision, (False, ""))

        # Sort dims by KL descending
        ranked = sorted(igs.items(), key=lambda kv: kv[1], reverse=True)
        top_keys = {k for k, _ in ranked[:_AUTO_SELECT_TOP_N]}

        dims = []
        for exp2_key, ig_val in ranked:
            if exp2_key not in _DIM_MAP:
                continue
            atp_col, display = _DIM_MAP[exp2_key]
            dims.append({
                "key": atp_col,
                "label": display,
                "kl": round(ig_val, 6),
                "auto_selected": exp2_key in top_keys,
            })

        out[domain] = {
            **meta,
            "needs_geo": needs_geo,
            "geo_decision": decision,
            "geo_note": geo_note,
            "dimensions": dims,
            "question_ids": _DOMAIN_QUESTIONS.get(domain, []),
        }
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ig",  metavar="PATH", help="Path to ig_single_by_domain.csv (Exp 2).")
    parser.add_argument("--geo", metavar="PATH", help="Path to js_by_domain.csv (Exp 3).")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic data (no external CSVs).")
    parser.add_argument("--out", metavar="PATH", default=str(OUT_PATH), help="Output JSON path.")
    args = parser.parse_args()

    if args.synthetic or (not args.ig and not args.geo):
        print("→ Using synthetic IG and geo data.", file=sys.stderr)
        ig_data = _SYNTHETIC_IG
        geo_data = _SYNTHETIC_GEO
    else:
        ig_data = _load_ig(Path(args.ig)) if args.ig else _SYNTHETIC_IG
        geo_data = _load_geo(Path(args.geo)) if args.geo else _SYNTHETIC_GEO

    catalog = build(ig_data, geo_data)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(catalog, indent=2))
    print(f"✓ Wrote {len(catalog)} domains → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
