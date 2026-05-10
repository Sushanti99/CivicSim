"""Command-line entry point for civicsim-agents.

Preserves the behaviour of the original ``main.py`` for backwards parity.
"""

from __future__ import annotations

import argparse
import os

from civicsim_agents.sample import (
    check_representativeness,
    format_representativeness_report,
    sample_agents,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate agents from a Bayesian demographic model "
        "(age x race x occupation x income).",
    )
    parser.add_argument(
        "--location",
        type=str,
        default="alameda_california",
        help="Location ID (e.g. alameda_california)",
    )
    parser.add_argument("--n_agents", type=int, default=25)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Print population vs. sample report",
    )
    parser.add_argument("--diverse", action="store_true", default=True)
    parser.add_argument(
        "--no-diverse",
        action="store_false",
        dest="diverse",
        help="Use independent random sampling instead of stratified",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        metavar="FILE",
        help="Also write the agent table to FILE (.csv or .txt)",
    )
    args = parser.parse_args()

    df = sample_agents(args.location, args.n_agents, seed=args.seed, diverse=args.diverse)
    print(df.to_string(index=False))

    report = None
    if args.validate:
        report = check_representativeness(args.location, df)
        print(format_representativeness_report(report, args.n_agents))

    if args.output:
        path = args.output
        if path.lower().endswith(".csv"):
            df.to_csv(path, index=False)
        else:
            content = df.to_string(index=False) + "\n"
            if report is not None:
                content += format_representativeness_report(report, args.n_agents)
            with open(path, "w") as f:
                f.write(content)
        print(f"\nWrote {os.path.abspath(path)}")


if __name__ == "__main__":
    main()
