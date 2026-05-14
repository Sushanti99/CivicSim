#!/usr/bin/env python3
"""
run_parallel.py — Run eval_table.py for all active domains in parallel,
then merge per-domain parquets into one combined report.

Usage:
    python evals/run_parallel.py                  # all domains, 30 agents
    python evals/run_parallel.py --n-agents 10    # faster test run
    python evals/run_parallel.py --dry-run        # show plan only
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent

# Auto-load .env
_dotenv = _REPO_ROOT / ".env"
if _dotenv.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_dotenv, override=False)
    except ImportError:
        for _line in _dotenv.read_text().splitlines():
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                k, _, v = _line.partition("=")
                if k.strip() not in os.environ and v.strip():
                    os.environ[k.strip()] = v.strip()

for _p in [str(_REPO_ROOT), str(_REPO_ROOT / "backend")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

DOMAIN_JSON = _REPO_ROOT / "data" / "atp_priors" / "domain_demographics.json"
RESULTS_DIR = _HERE / "results"
SCRATCH_DIR = RESULTS_DIR / "_parallel_scratch"

_print_lock = threading.Lock()

def _status(domain: str, msg: str) -> None:
    with _print_lock:
        print(f"  [{domain}] {msg}", flush=True)


def active_domains() -> list[str]:
    with open(DOMAIN_JSON) as f:
        catalog = json.load(f)
    return [d for d, info in catalog.items() if info.get("question_ids")]


def run_domain(domain: str, n_agents: int, dry_run: bool, scratch: Path) -> tuple[str, int, float]:
    out_dir = scratch / domain
    out_dir.mkdir(parents=True, exist_ok=True)
    log_path = out_dir / "run.log"

    cmd = [
        sys.executable,
        str(_HERE / "eval_table.py"),
        "--domain", domain,
        "--n-agents", str(n_agents),
        "--output-dir", str(out_dir),
    ]
    if dry_run:
        cmd.append("--dry-run")

    t0 = time.time()
    _status(domain, "starting…")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ},
    )

    with open(log_path, "w") as logf:
        for line in proc.stdout:
            logf.write(line)
            logf.flush()
            line = line.rstrip()
            if line:
                _status(domain, line)

    proc.wait()
    elapsed = time.time() - t0
    result = "done" if proc.returncode == 0 else f"FAILED (rc={proc.returncode})"
    _status(domain, f"{result} in {elapsed:.0f}s")
    return domain, proc.returncode, elapsed


def merge_parquets(scratch: Path, domains: list[str]) -> None:
    import pandas as pd
    from evals.eval_table import build_markdown_report, build_html_report

    frames = []
    all_rows: list[dict] = []

    for domain in domains:
        pq = scratch / domain / "eval_table.parquet"
        if not pq.exists():
            print(f"  WARNING: no parquet for domain '{domain}' — skipping")
            continue
        df = pd.read_parquet(pq)
        frames.append(df)

    if not frames:
        print("ERROR: no domain results to merge.")
        sys.exit(1)

    combined = pd.concat(frames, ignore_index=True)
    RESULTS_DIR.mkdir(exist_ok=True)
    combined.to_parquet(RESULTS_DIR / "eval_table.parquet", index=False)
    print(f"Merged parquet: {len(combined)} rows → {RESULTS_DIR / 'eval_table.parquet'}")

    # Reconstruct row dicts for report generation
    import json as _json
    for _, row in combined.iterrows():
        r = row.to_dict()
        for col in ["gt_dist", "civicsim_dist", "naive_anthropic_dist", "naive_openai_dist"]:
            raw = r.get(col)
            r[col] = _json.loads(raw) if isinstance(raw, str) else raw
        metrics_civicsim, metrics_naive_anthropic, metrics_naive_openai = {}, {}, {}
        for cond, m in [("civicsim", metrics_civicsim), ("naive_anthropic", metrics_naive_anthropic), ("naive_openai", metrics_naive_openai)]:
            for metric in ["tvd", "kl", "hellinger", "wasserstein"]:
                v = r.get(f"{cond}_{metric}")
                if v is not None:
                    m[metric] = float(v)
        r["metrics_civicsim"] = metrics_civicsim
        r["metrics_naive_anthropic"] = metrics_naive_anthropic
        r["metrics_naive_openai"] = metrics_naive_openai
        r["slice"] = {k: v for kv in r.get("slice_str", "").split(", ") for k, v in [kv.split("=", 1)] if "=" in kv}
        all_rows.append(r)

    total_elapsed = combined["n_agents"].sum() if "n_agents" in combined.columns else 0
    md = build_markdown_report(all_rows, total_elapsed)
    (RESULTS_DIR / "eval_report.md").write_text(md)

    html = build_html_report(all_rows, total_elapsed)
    (RESULTS_DIR / "eval_report.html").write_text(html)

    print(f"Reports written to {RESULTS_DIR}/")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--n-agents", type=int, default=30)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--domains", nargs="+", help="Specific domains (default: all active)")
    args = p.parse_args()

    domains = args.domains or active_domains()
    print(f"Running {len(domains)} domains in parallel: {', '.join(domains)}")
    print(f"Agents per slice: {args.n_agents}")
    print()

    if args.dry_run:
        for d in domains:
            print(f"  [dry-run] would run: --domain {d} --n-agents {args.n_agents}")
        return

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Logs → {SCRATCH_DIR}/<domain>/run.log\n")

    t0 = time.time()

    # Launch all domain processes in parallel
    from concurrent.futures import ThreadPoolExecutor, as_completed
    futures = {}
    with ThreadPoolExecutor(max_workers=len(domains)) as pool:
        for domain in domains:
            fut = pool.submit(run_domain, domain, args.n_agents, args.dry_run, SCRATCH_DIR)
            futures[fut] = domain

        failed = []
        for fut in as_completed(futures):
            domain, rc, elapsed = fut.result()
            if rc != 0:
                failed.append(domain)
                log = SCRATCH_DIR / domain / "run.log"
                with _print_lock:
                    print(f"\n  ERROR log tail for '{domain}':")
                    for line in (log.read_text().splitlines() or [])[-8:]:
                        print(f"    {line}")

    print(f"\nAll domains finished in {time.time() - t0:.0f}s.")
    if failed:
        print(f"  Failed domains: {', '.join(failed)}")
    print("Merging results…")
    merge_parquets(SCRATCH_DIR, domains)
    print("Done.")


if __name__ == "__main__":
    main()
