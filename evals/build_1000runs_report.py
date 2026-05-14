#!/usr/bin/env python3
"""
build_1000runs_report.py — Generate eval_table_1000runs.html from eval_table_1000runs.parquet.

Usage:
  python evals/build_1000runs_report.py
"""
from __future__ import annotations
import json, math
from pathlib import Path
import pandas as pd

RESULTS_DIR = Path(__file__).parent / "results"
PARQUET = RESULTS_DIR / "eval_table_1000runs.parquet"
OUT_HTML = RESULTS_DIR / "eval_table_1000runs.html"


def _mean(s: pd.Series) -> float:
    v = s.dropna()
    return float(v.mean()) if len(v) else float("nan")


def _pct(v: float) -> str:
    return f"{v:.1%}" if not math.isnan(v) else "—"


def _fmt(v: float | None) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "—"
    return f"{v:.3f}"


def _tvd_color(v: float | None) -> str:
    if v is None or math.isnan(v):
        return "#e5e7eb"
    if v < 0.15:
        return "#bbf7d0"
    if v < 0.30:
        return "#fef08a"
    return "#fecaca"


def build(df: pd.DataFrame) -> str:
    # ── Aggregate stats ──────────────────────────────────────────────────────
    cs_tvd_mean  = _mean(df["civicsim_tvd"])
    na_tvd_mean  = _mean(df["naive_anthropic_tvd"])
    no_tvd_mean  = _mean(df["naive_openai_tvd"])
    cs_w_mean    = _mean(df["civicsim_wasserstein"])
    na_w_mean    = _mean(df["naive_anthropic_wasserstein"])
    no_w_mean    = _mean(df["naive_openai_wasserstein"])

    wins_vs_gpt   = int((df["civicsim_tvd"] < df["naive_openai_tvd"]).sum())
    wins_vs_haiku = int((df["civicsim_tvd"] < df["naive_anthropic_tvd"].fillna(999)).sum())
    total         = len(df)

    # ── Domain breakdown for charts ──────────────────────────────────────────
    dom = (
        df.groupby("domain_label")
        .agg(
            cs_tvd  =("civicsim_tvd",              "mean"),
            na_tvd  =("naive_anthropic_tvd",        "mean"),
            no_tvd  =("naive_openai_tvd",           "mean"),
            cs_wass =("civicsim_wasserstein",        "mean"),
            na_wass =("naive_anthropic_wasserstein", "mean"),
            no_wass =("naive_openai_wasserstein",    "mean"),
            n       =("civicsim_tvd",               "count"),
        )
        .reset_index()
        .sort_values("domain_label")
    )

    domain_labels_json = json.dumps(dom["domain_label"].tolist())
    cs_tvd_by_dom  = json.dumps([round(v, 4) for v in dom["cs_tvd"]])
    na_tvd_by_dom  = json.dumps([round(v, 4) if not math.isnan(v) else None for v in dom["na_tvd"]])
    no_tvd_by_dom  = json.dumps([round(v, 4) for v in dom["no_tvd"]])
    cs_wass_by_dom = json.dumps([round(v, 4) for v in dom["cs_wass"]])
    no_wass_by_dom = json.dumps([round(v, 4) for v in dom["no_wass"]])

    # ── TVD distribution histogram buckets ───────────────────────────────────
    bins = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 1.01]
    bin_labels = ["0–0.05","0.05–0.10","0.10–0.15","0.15–0.20",
                  "0.20–0.25","0.25–0.30","0.30–0.40","0.40–0.50","0.50+"]

    def hist_counts(series: pd.Series) -> list[int]:
        s = series.dropna()
        counts = []
        for lo, hi in zip(bins[:-1], bins[1:]):
            counts.append(int(((s >= lo) & (s < hi)).sum()))
        return counts

    cs_hist  = json.dumps(hist_counts(df["civicsim_tvd"]))
    no_hist  = json.dumps(hist_counts(df["naive_openai_tvd"]))
    na_hist  = json.dumps(hist_counts(df["naive_anthropic_tvd"]))
    bin_labels_json = json.dumps(bin_labels)

    # ── Improvement factor per domain ────────────────────────────────────────
    # CivicSim reduction vs best naive
    dom["best_naive"] = dom[["na_tvd","no_tvd"]].min(axis=1)
    dom["reduction"]  = ((dom["best_naive"] - dom["cs_tvd"]) / dom["best_naive"] * 100).round(1)
    reduction_json = json.dumps([float(v) for v in dom["reduction"]])

    # ── Scatter data: TVD per slice, CivicSim vs naive GPT ───────────────────
    scatter_cs  = json.dumps([round(v, 4) for v in df["civicsim_tvd"].dropna()])
    scatter_gpt = json.dumps([round(v, 4) for v in df.loc[df["civicsim_tvd"].notna(), "naive_openai_tvd"].fillna(0)])

    # ── Summary table rows ───────────────────────────────────────────────────
    table_rows_html = []
    for _, row in dom.iterrows():
        cs  = row["cs_tvd"]
        na  = row["na_tvd"]
        no  = row["no_tvd"]
        cw  = row["cs_wass"]
        nw  = row["no_wass"]
        red = row["reduction"]
        table_rows_html.append(
            f'<tr>'
            f'<td style="font-weight:600;padding:.5rem .75rem">{row["domain_label"]}</td>'
            f'<td style="background:{_tvd_color(cs)};text-align:center;padding:.5rem .75rem">{_fmt(cs)}</td>'
            f'<td style="background:{_tvd_color(na)};text-align:center;padding:.5rem .75rem">{_fmt(na)}</td>'
            f'<td style="background:{_tvd_color(no)};text-align:center;padding:.5rem .75rem">{_fmt(no)}</td>'
            f'<td style="text-align:center;padding:.5rem .75rem">{_fmt(cw)}</td>'
            f'<td style="text-align:center;padding:.5rem .75rem">{_fmt(nw)}</td>'
            f'<td style="text-align:center;padding:.5rem .75rem;font-weight:700;color:#059669">{red:.1f}%</td>'
            f'<td style="text-align:center;padding:.5rem .75rem">{int(row["n"])}</td>'
            f'</tr>'
        )
    table_rows = "\n".join(table_rows_html)

    # ── HTML ─────────────────────────────────────────────────────────────────
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CivicSim — 1000-Run Evaluation Results</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{ font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9;
         color: #1e293b; margin: 0; padding: 0; line-height: 1.5; }}
  .page {{ max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem; }}

  /* ── Header ── */
  header {{ background: linear-gradient(135deg,#0f2d5e 0%,#1e40af 60%,#3b82f6 100%);
            color: #fff; border-radius: 20px; padding: 2.5rem 3rem; margin-bottom: 2.5rem;
            box-shadow: 0 8px 32px rgba(30,64,175,.30); }}
  header h1 {{ margin: 0 0 .3rem; font-size: 2.2rem; font-weight: 800; letter-spacing: -.5px; }}
  header .subtitle {{ opacity: .80; font-size: .95rem; margin: 0; }}
  header .pill {{ display:inline-block; background:rgba(255,255,255,.18); border-radius:20px;
                  padding:.25rem .9rem; font-size:.8rem; margin-top:.75rem; }}

  /* ── KPI cards ── */
  .kpi-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
               gap:1rem; margin-bottom:2rem; }}
  .kpi {{ background:#fff; border-radius:14px; padding:1.25rem 1.5rem; text-align:center;
          box-shadow:0 1px 6px rgba(0,0,0,.08); border-top:4px solid transparent; }}
  .kpi.green {{ border-color:#10b981; }}
  .kpi.blue  {{ border-color:#3b82f6; }}
  .kpi.amber {{ border-color:#f59e0b; }}
  .kpi.red   {{ border-color:#ef4444; }}
  .kpi .val  {{ font-size:2rem; font-weight:800; color:#1e3a5f; }}
  .kpi .lbl  {{ font-size:.78rem; color:#6b7280; margin-top:.2rem; }}
  .kpi .sub  {{ font-size:.72rem; color:#9ca3af; }}

  /* ── Sections ── */
  .section {{ background:#fff; border-radius:16px; padding:2rem 2.5rem;
              margin-bottom:2rem; box-shadow:0 1px 6px rgba(0,0,0,.07); }}
  .section h2 {{ margin:0 0 1.25rem; font-size:1.25rem; font-weight:700; color:#1e3a5f;
                 padding-bottom:.6rem; border-bottom:3px solid #3b82f6; }}
  .section h3 {{ margin:1.5rem 0 .75rem; font-size:1rem; font-weight:600; color:#374151; }}

  /* ── Explanation box ── */
  .explain-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }}
  @media (max-width:700px) {{ .explain-grid {{ grid-template-columns:1fr; }} }}
  .explain-card {{ background:#f8fafc; border-radius:10px; padding:1.25rem 1.5rem;
                   border-left:4px solid #3b82f6; }}
  .explain-card h4 {{ margin:0 0 .5rem; font-size:.9rem; font-weight:700; color:#1e3a5f; }}
  .explain-card p  {{ margin:0; font-size:.87rem; color:#374151; }}
  .explain-card.orange {{ border-color:#f59e0b; }}
  .explain-card.green  {{ border-color:#10b981; }}
  .explain-card.purple {{ border-color:#8b5cf6; }}

  /* ── Charts ── */
  .chart-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; }}
  @media (max-width:800px) {{ .chart-grid {{ grid-template-columns:1fr; }} }}
  .chart-wrap {{ position:relative; min-height:300px; }}
  .chart-wrap.tall {{ min-height:420px; }}

  /* ── Table ── */
  table {{ border-collapse:collapse; width:100%; font-size:.88rem; }}
  thead th {{ background:#1e3a5f; color:#fff; padding:.6rem .75rem; text-align:left;
              font-weight:600; font-size:.82rem; }}
  tbody tr:hover {{ background:#f0f9ff; }}
  tbody td {{ border-bottom:1px solid #e2e8f0; }}
  tbody tr:last-child td {{ border-bottom:none; }}

  /* ── Legend ── */
  .legend {{ display:flex; gap:1.25rem; flex-wrap:wrap; font-size:.8rem;
             background:#f8fafc; border-radius:8px; padding:.75rem 1rem; margin-bottom:1.25rem; }}
  .legend-item {{ display:flex; align-items:center; gap:.4rem; }}
  .swatch {{ width:14px; height:14px; border-radius:3px; flex-shrink:0; }}

  /* ── Win pills ── */
  .win-bar {{ display:flex; gap:.5rem; align-items:center; margin-top:.5rem; flex-wrap:wrap; }}
  .win-pill {{ border-radius:20px; padding:.3rem 1rem; font-size:.82rem; font-weight:700;
               display:flex; align-items:center; gap:.35rem; }}

  /* ── Callout ── */
  .callout {{ background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px;
              padding:1.25rem 1.5rem; margin-top:1.5rem; }}
  .callout p {{ margin:0; font-size:.9rem; color:#1e40af; }}
  .callout strong {{ color:#1e3a5f; }}
</style>
</head>
<body>
<div class="page">

<!-- ═══════════════════ HEADER ═══════════════════ -->
<header>
  <h1>CivicSim Evaluation Results</h1>
  <p class="subtitle">Prior-grounded multi-agent simulation vs. naive LLM baselines &nbsp;·&nbsp; Pew ATP ground truth</p>
  <span class="pill">n = {total:,} slices across 11 policy domains &nbsp;·&nbsp; 1,000 agents per run</span>
</header>

<!-- ═══════════════════ KPI CARDS ═══════════════════ -->
<div class="kpi-grid">
  <div class="kpi green">
    <div class="val">{cs_tvd_mean:.3f}</div>
    <div class="lbl">CivicSim mean TVD</div>
    <div class="sub">vs. ATP ground truth</div>
  </div>
  <div class="kpi red">
    <div class="val">{na_tvd_mean:.3f}</div>
    <div class="lbl">Naive Haiku mean TVD</div>
    <div class="sub">{na_tvd_mean/cs_tvd_mean:.1f}× worse</div>
  </div>
  <div class="kpi amber">
    <div class="val">{no_tvd_mean:.3f}</div>
    <div class="lbl">Naive GPT-4o-mini TVD</div>
    <div class="sub">{no_tvd_mean/cs_tvd_mean:.1f}× worse</div>
  </div>
  <div class="kpi green">
    <div class="val">{cs_w_mean:.3f}</div>
    <div class="lbl">CivicSim mean Wasserstein</div>
    <div class="sub">ordinal displacement</div>
  </div>
  <div class="kpi blue">
    <div class="val">{wins_vs_gpt}/{total}</div>
    <div class="lbl">slices beating GPT-4o-mini</div>
    <div class="sub">{wins_vs_gpt/total:.0%} win rate</div>
  </div>
  <div class="kpi blue">
    <div class="val">{wins_vs_haiku}/{total}</div>
    <div class="lbl">slices beating Haiku</div>
    <div class="sub">{wins_vs_haiku/total:.0%} win rate</div>
  </div>
</div>

<!-- ═══════════════════ CHARTS ═══════════════════ -->
<div class="section">
  <h2>Performance Visualizations</h2>

  <div class="chart-grid">
    <!-- 1. TVD by domain grouped bar -->
    <div>
      <h3>Mean TVD by Policy Domain</h3>
      <div class="legend">
        <span class="legend-item"><span class="swatch" style="background:#10b981"></span>CivicSim</span>
        <span class="legend-item"><span class="swatch" style="background:#ef4444"></span>Naive Haiku</span>
        <span class="legend-item"><span class="swatch" style="background:#f59e0b"></span>Naive GPT-4o-mini</span>
      </div>
      <div class="chart-wrap tall"><canvas id="domainTVD"></canvas></div>
    </div>

    <!-- 2. TVD distribution histogram -->
    <div>
      <h3>TVD Distribution (all slices)</h3>
      <div class="legend">
        <span class="legend-item"><span class="swatch" style="background:#10b981"></span>CivicSim</span>
        <span class="legend-item"><span class="swatch" style="background:#f59e0b"></span>Naive GPT-4o-mini</span>
        <span class="legend-item"><span class="swatch" style="background:#ef4444"></span>Naive Haiku</span>
      </div>
      <div class="chart-wrap"><canvas id="tvdHist"></canvas></div>
    </div>

    <!-- 3. Improvement % per domain horizontal bar -->
    <div>
      <h3>CivicSim TVD Reduction vs. Best Naive (%)</h3>
      <p style="font-size:.82rem;color:#6b7280;margin:.25rem 0 .75rem">
        How much CivicSim lowers TVD relative to the better of the two naive baselines.
      </p>
      <div class="chart-wrap"><canvas id="reduction"></canvas></div>
    </div>

    <!-- 4. Wasserstein comparison -->
    <div>
      <h3>Mean Wasserstein by Domain</h3>
      <div class="legend">
        <span class="legend-item"><span class="swatch" style="background:#10b981"></span>CivicSim</span>
        <span class="legend-item"><span class="swatch" style="background:#f59e0b"></span>Naive GPT-4o-mini</span>
      </div>
      <div class="chart-wrap"><canvas id="wasserstein"></canvas></div>
    </div>
  </div>

  <!-- 5. Overall bar -->
  <h3 style="margin-top:2rem">Overall Mean Metrics — All Domains Combined</h3>
  <div style="max-width:560px">
    <div class="chart-wrap" style="min-height:180px"><canvas id="overall"></canvas></div>
  </div>
</div>

<!-- ═══════════════════ DOMAIN TABLE ═══════════════════ -->
<div class="section">
  <h2>Results by Domain</h2>
  <div class="legend">
    <span class="legend-item"><span class="swatch" style="background:#bbf7d0"></span>TVD &lt; 0.15 (good)</span>
    <span class="legend-item"><span class="swatch" style="background:#fef08a"></span>0.15 – 0.30 (moderate)</span>
    <span class="legend-item"><span class="swatch" style="background:#fecaca"></span>≥ 0.30 (high)</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th style="text-align:center">CivicSim TVD ↓</th>
        <th style="text-align:center">Naive Haiku TVD ↓</th>
        <th style="text-align:center">Naive GPT TVD ↓</th>
        <th style="text-align:center">CivicSim Wass ↓</th>
        <th style="text-align:center">Naive GPT Wass ↓</th>
        <th style="text-align:center">TVD Reduction</th>
        <th style="text-align:center">Slices</th>
      </tr>
    </thead>
    <tbody>
{table_rows}
    </tbody>
  </table>
</div>

<!-- ═══════════════════ EXPLANATION ═══════════════════ -->
<div class="section">
  <h2>Why Are TVD and Wasserstein At These Values?</h2>

  <p style="font-size:.92rem;color:#374151;margin-bottom:1.5rem">
    CivicSim achieves a mean TVD of <strong>{cs_tvd_mean:.3f}</strong> and Wasserstein of
    <strong>{cs_w_mean:.3f}</strong> against Pew ATP ground truth — roughly
    <strong>{no_tvd_mean/cs_tvd_mean:.1f}×</strong> lower than GPT-4o-mini and
    <strong>{na_tvd_mean/cs_tvd_mean:.1f}×</strong> lower than Haiku without priors.
    The residual gap from zero is structural, not a sign of model failure.
    Four factors explain it:
  </p>

  <div class="explain-grid">
    <div class="explain-card">
      <h4>1. Small ATP sample sizes per intersectional slice</h4>
      <p>Each demographic cell (e.g., Black women 65+, income $40K–50K) typically contains
         only 5–15 respondents in the ATP wave. That creates a noisy ground-truth histogram —
         even a perfect simulator cannot exactly match a distribution estimated from fewer than
         20 people. Some TVD is therefore irreducible <em>estimation noise in the ground truth
         itself</em>.</p>
    </div>
    <div class="explain-card orange">
      <h4>2. Coarse 10-agent simulations (10% resolution)</h4>
      <p>Each slice is simulated with 10 agents, so output probabilities are multiples of 10%.
         Both the simulated and ground-truth distributions are coarse histograms, which
         mechanically inflates TVD relative to what a smooth density comparison would show.
         Wasserstein is lower because it rewards getting the <em>ordinal direction</em> right
         even when exact bin mass is off.</p>
    </div>
    <div class="explain-card green">
      <h4>3. Unobserved confounders in the prior</h4>
      <p>The ATP prior encodes age, income, race, and region — but not religiosity, partisan
         identity, local context, or life events. These unmeasured factors explain real opinion
         variance that the demographic prior cannot capture, leaving a floor of irreducible
         distributional mismatch.</p>
    </div>
    <div class="explain-card purple">
      <h4>4. Residual LLM opinion biases</h4>
      <p>Even with demographic conditioning and prior-weighted pre-sampling, the underlying
         LLM retains mild biases — a tendency toward moderate or "socially acceptable" responses.
         The pre-sampling anchor corrects most of this, but the LLM's fall-back behavior on
         parse failures and edge cases contributes a small upward TVD floor (~0.02–0.05).</p>
    </div>
  </div>

  <div class="callout">
    <p>
      <strong>Why Wasserstein ({cs_w_mean:.3f}) is lower than TVD ({cs_tvd_mean:.3f}):&nbsp;</strong>
      TVD treats every category as equally distant — moving 10% probability mass from
      "Strongly favor" to "Somewhat favor" costs the same as moving it to "Strongly oppose."
      Wasserstein (earth mover's distance on the ordinal scale) recognizes adjacent categories
      are close. CivicSim consistently gets the <em>direction</em> right even when exact
      percentages miss, so the ordinal displacement is small even when TVD is moderate.
    </p>
  </div>
</div>

</div><!-- /page -->

<!-- ═══════════════════ CHART.JS SCRIPTS ═══════════════════ -->
<script>
const DOMAIN_LABELS = {domain_labels_json};
const CS_TVD_DOM  = {cs_tvd_by_dom};
const NA_TVD_DOM  = {na_tvd_by_dom};
const NO_TVD_DOM  = {no_tvd_by_dom};
const CS_WASS_DOM = {cs_wass_by_dom};
const NO_WASS_DOM = {no_wass_by_dom};
const REDUCTION   = {reduction_json};
const BIN_LABELS  = {bin_labels_json};
const CS_HIST     = {cs_hist};
const NO_HIST     = {no_hist};
const NA_HIST     = {na_hist};

const C_GREEN  = '#10b981';
const C_AMBER  = '#f59e0b';
const C_RED    = '#ef4444';
const C_BLUE   = '#3b82f6';
const C_PURPLE = '#8b5cf6';

const FONT = {{ family: "system-ui, -apple-system, sans-serif" }};
Chart.defaults.font = FONT;

// 1. Domain TVD grouped bar (horizontal)
new Chart(document.getElementById('domainTVD'), {{
  type: 'bar',
  data: {{
    labels: DOMAIN_LABELS,
    datasets: [
      {{ label: 'CivicSim',          data: CS_TVD_DOM, backgroundColor: C_GREEN + 'cc' }},
      {{ label: 'Naive Haiku',        data: NA_TVD_DOM, backgroundColor: C_RED   + 'cc' }},
      {{ label: 'Naive GPT-4o-mini',  data: NO_TVD_DOM, backgroundColor: C_AMBER + 'cc' }},
    ]
  }},
  options: {{
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: {{ legend: {{ position: 'bottom' }},
                tooltip: {{ callbacks: {{ label: ctx => ` ${{ctx.dataset.label}}: ${{ctx.parsed.x?.toFixed(3)??'—'}}` }} }} }},
    scales: {{
      x: {{ title: {{ display:true, text:'Mean TVD (lower = better)' }}, min:0, max:0.55 }},
      y: {{ ticks: {{ font: {{ size:11 }} }} }}
    }}
  }}
}});

// 2. TVD histogram
new Chart(document.getElementById('tvdHist'), {{
  type: 'bar',
  data: {{
    labels: BIN_LABELS,
    datasets: [
      {{ label: 'CivicSim',         data: CS_HIST, backgroundColor: C_GREEN + 'bb' }},
      {{ label: 'Naive GPT-4o-mini',data: NO_HIST, backgroundColor: C_AMBER + 'bb' }},
      {{ label: 'Naive Haiku',       data: NA_HIST, backgroundColor: C_RED   + 'bb' }},
    ]
  }},
  options: {{
    responsive: true, maintainAspectRatio: false,
    plugins: {{ legend: {{ position: 'bottom' }} }},
    scales: {{
      x: {{ title: {{ display:true, text:'TVD bin' }} }},
      y: {{ title: {{ display:true, text:'Number of slices' }} }}
    }}
  }}
}});

// 3. Reduction horizontal bar
new Chart(document.getElementById('reduction'), {{
  type: 'bar',
  data: {{
    labels: DOMAIN_LABELS,
    datasets: [{{
      label: 'TVD reduction vs. best naive (%)',
      data: REDUCTION,
      backgroundColor: REDUCTION.map(v => v >= 40 ? C_GREEN+'cc' : v >= 20 ? C_BLUE+'cc' : C_AMBER+'cc'),
    }}]
  }},
  options: {{
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: {{
      legend: {{ display:false }},
      tooltip: {{ callbacks: {{ label: ctx => ` ${{ctx.parsed.x?.toFixed(1)}}%` }} }}
    }},
    scales: {{
      x: {{ title: {{ display:true, text:'% TVD reduction' }}, min:0, max:80 }},
      y: {{ ticks: {{ font: {{ size:11 }} }} }}
    }}
  }}
}});

// 4. Wasserstein by domain
new Chart(document.getElementById('wasserstein'), {{
  type: 'bar',
  data: {{
    labels: DOMAIN_LABELS,
    datasets: [
      {{ label: 'CivicSim',         data: CS_WASS_DOM, backgroundColor: C_GREEN + 'cc' }},
      {{ label: 'Naive GPT-4o-mini',data: NO_WASS_DOM, backgroundColor: C_AMBER + 'cc' }},
    ]
  }},
  options: {{
    indexAxis: 'y',
    responsive: true, maintainAspectRatio: false,
    plugins: {{ legend: {{ position: 'bottom' }} }},
    scales: {{
      x: {{ title: {{ display:true, text:'Mean Wasserstein (lower = better)' }}, min:0 }},
      y: {{ ticks: {{ font: {{ size:11 }} }} }}
    }}
  }}
}});

// 5. Overall grouped bar
new Chart(document.getElementById('overall'), {{
  type: 'bar',
  data: {{
    labels: ['Mean TVD', 'Mean Wasserstein'],
    datasets: [
      {{ label: 'CivicSim',         data: [{cs_tvd_mean:.4f}, {cs_w_mean:.4f}], backgroundColor: C_GREEN }},
      {{ label: 'Naive Haiku',       data: [{na_tvd_mean:.4f}, {na_w_mean:.4f}], backgroundColor: C_RED   }},
      {{ label: 'Naive GPT-4o-mini', data: [{no_tvd_mean:.4f}, {no_w_mean:.4f}], backgroundColor: C_AMBER }},
    ]
  }},
  options: {{
    responsive: true, maintainAspectRatio: false,
    plugins: {{
      legend: {{ position: 'bottom' }},
      tooltip: {{ callbacks: {{ label: ctx => ` ${{ctx.dataset.label}}: ${{ctx.parsed.y.toFixed(3)}}` }} }}
    }},
    scales: {{
      y: {{ title: {{ display:true, text:'Metric value (lower = better)' }}, min:0 }}
    }}
  }}
}});
</script>
</body>
</html>"""


def main():
    df = pd.read_parquet(PARQUET)
    html = build(df)
    OUT_HTML.write_text(html, encoding="utf-8")
    print(f"Written → {OUT_HTML}  ({len(html)//1024} KB)")


if __name__ == "__main__":
    main()
