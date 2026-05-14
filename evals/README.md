# CivicSim Evals

Evaluation framework for measuring how accurately CivicSim agents reproduce real survey opinion distributions from the Pew American Trends Panel (ATP).

---

## Files

| File | Role |
|---|---|
| `eval_table.py` | **Primary benchmark.** Compares CivicSim vs. two naive LLM baselines across domains × questions × demographic slices. Writes results to `results/`. |
| `evaluator.py` | Dataclasses and logic for evaluating a single saved simulation against the ATP national prior. |
| `metrics.py` | Pure math — no backend dependencies. TVD, KL, Wasserstein, Wilson CI, prior adherence functions. |
| `run_eval.py` | CLI wrapper around `evaluator.py` for single-simulation diagnostics. |
| `results/` | Output from the last `eval_table.py` run: `eval_report.md`, `eval_report.html`, `eval_table.parquet`. |

---

## Comparative Benchmark — `eval_table.py`

For each *(domain × question × demographic slice)* combination, runs three conditions against S3 ATP ground truth:

| Condition | Model | ATP Prior in prompt? |
|---|---|---|
| **CivicSim** | Claude Haiku | Yes — pre-samples each agent's stance from their demographic prior, then confirms via LLM |
| **Naive Anthropic** | Claude Haiku | No — persona only |
| **Naive OpenAI** | GPT-4o-mini | No — persona only |

**Ground truth** is computed from the full S3 respondent-level dataset (`s3://civicsim-data/parquet/atp_2021_2024_final.parquet`), filtered to the demographic slice and weighted by `WEIGHT`.

### Demographic slice selection

`find_diverse_slices()` selects up to 20 varied slices per question using a three-phase stratified strategy:

1. **1-dim marginals first** — one slice per unique value of each domain dimension (every income bracket, race group, age group appears before any group is doubled).
2. **2-dim cross-cuts** — round-robin across dimension-value pairs for coverage of intersectional groups.
3. **3-dim combinations** — fill remaining slots if still under 20.

This avoids the bias toward high-income / White respondents that occurs when selecting by row count descending.

### CivicSim agent methodology

Each CivicSim agent in the eval:

1. Gets a demographic profile sampled from ACS census distributions for the target location.
2. Gets a **demographic-specific prior** computed by `_compact_marginal_prior()` — averages all compact-parquet rows matching the agent's available dims (`age_group`, `race_eth`, `income_group`), giving real demographic conditioning without requiring a full 8-dim cell match.
3. Has their **stance pre-sampled** from that prior distribution before the LLM call. The LLM then confirms the stance. This forces the aggregate distribution to track the prior rather than collapsing to the LLM's modal preference.

### Metrics computed per row

| Metric | Description |
|---|---|
| `tvd` | Total Variation Distance — half the L1 norm between simulated and ground-truth distributions. Bounded [0, 1]. |
| `kl` | KL divergence from ground truth to simulated. Asymmetric; penalises under-represented answers. |
| `hellinger` | Hellinger distance — symmetric, bounded [0, 1]. |
| `wasserstein` | Normalized Earth Mover's Distance (NEMD). Respects ordinal structure of Likert responses; preferred primary metric. Only computed when ordinal order is detected. |

### How to run

```bash
# Prerequisites: .env with ANTHROPIC_API_KEY, OPENAI_API_KEY, AWS_ACCESS_KEY_ID,
#               AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION

python evals/eval_table.py                        # full table (all domains)
python evals/eval_table.py --domain economy       # single domain
python evals/eval_table.py --dry-run              # show plan, no LLM calls
python evals/eval_table.py --n-agents 10          # override agent count
```

**Configuration via env vars:**

| Variable | Default | Description |
|---|---|---|
| `EVAL_N_AGENTS` | `30` | Agents per condition per row |
| `EVAL_D_SLICES` | `20` | Demographic slices per question |
| `EVAL_Q_PER_DOMAIN` | `2` | Questions evaluated per domain |

**Outputs written to `evals/results/`:**

- `eval_table.parquet` — full results table (one row per domain × question × slice)
- `eval_report.md` — markdown report
- `eval_report.html` — styled HTML report with colour-coded metrics

### Reading the parquet output

```python
import pandas as pd
df = pd.read_parquet("evals/results/eval_table.parquet")

# Key columns:
# domain, question_id, question_label, slice (dict), gt_source
# gt_dist, civicsim_dist, naive_anthropic_dist, naive_openai_dist
# civicsim_tvd, civicsim_wasserstein, civicsim_kl, civicsim_hellinger
# naive_anthropic_tvd, naive_anthropic_wasserstein, ...
# naive_openai_tvd, naive_openai_wasserstein, ...
```

---

## Single-Simulation Evaluator — `evaluator.py` / `run_eval.py`

Evaluates one saved simulation from `data/simulations/<sim_id>/` against the **ATP national marginal prior** (the fully-marginal `ALL`-dims row in the compact parquet).

### Data flow

```
data/simulations/<sim_id>/
  _meta.json          → question_id, location, n, selected_dims
  _summary.json       → aggregate distribution of stances
  agent_0000.json     → {demographics, prior, stance, rationale, used_filter, backoff_steps}
  ...

data/atp_priors/policy_priors.parquet
  → national marginal row (all dims = "ALL") = ground truth
```

### Key dataclasses (`evaluator.py`)

**`AgentEval`** — per-agent result:
- `stance_valid` — stance is one of the listed answer options
- `prior_prob` — ATP prior probability of the chosen stance for that demographic cell
- `prior_rank` — 1 = modal answer, 2 = second most likely, etc.
- `modal_agreement` — True if agent chose the highest-probability answer
- `used_filter` / `backoff_steps` — which demographic dims were used / dropped

**`DemographicGroupEval`** — per-group result:
- Groups agents by `age_group`, `race_eth`, `income_group`, `urbanicity`
- Computes `tvd` and `wasserstein` between the group's simulated distribution and its average prior

**`SimulationEval`** — aggregate result:
- `validity_rate` — fraction of agents with a valid stance
- `mean_prior_prob` — average ATP prior probability of each agent's chosen stance
- `modal_agreement_rate` / `top2_rate` — prior adherence signals
- `tvd_vs_national`, `kl_vs_national`, `wasserstein_vs_national` — accuracy vs. ATP national prior
- `answer_coverage` — fraction of answer options chosen by at least one agent
- `confidence_intervals` — Wilson 95% CI per answer option given finite n
- `prior_in_ci_rate` — fraction of ATP national priors that fall inside the simulated CIs (1.0 = statistically consistent)

### Metrics (`metrics.py`)

| Function | Description |
|---|---|
| `total_variation_distance(p, q)` | ½ Σ \|p_k − q_k\| — bounded [0, 1] |
| `kl_divergence(p, q)` | Σ p_k log(p_k / q_k) — asymmetric, ε-smoothed |
| `wasserstein_distance(p, q)` | NEMD — normalized Wasserstein-1; respects ordinal order |
| `prior_prob_of_stance(stance, prior)` | ATP probability assigned to the chosen answer |
| `prior_rank_of_stance(stance, prior)` | 1-indexed rank within the prior |
| `modal_answer(prior)` | Highest-probability answer label |
| `stances_to_distribution(stances, options)` | Counter → probability dict |
| `expected_log_likelihood(records)` | Mean log P(stance \| prior) |
| `wilson_ci(k, n)` | Wilson 95% CI for a proportion |
| `answer_cis(counts, n)` | Wilson CIs for all answer options |
| `prior_in_ci_rate(national_prior, cis)` | Fraction of ATP priors inside simulated CIs |

### Python API

```python
from evals.evaluator import evaluate_sim_id

ev = evaluate_sim_id("001__region_west__environment_climate__20260514_013000")

ev.tvd_vs_national          # float — lower is better
ev.wasserstein_vs_national  # float — lower is better, respects ordinal structure
ev.prior_in_ci_rate         # float — 1.0 means statistically consistent with ATP
ev.modal_agreement_rate     # float — fraction choosing modal answer for their cell
ev.answer_coverage          # float — fraction of options chosen by at least one agent

for ae in ev.agent_evals:
    print(ae.agent_id, ae.stance, ae.prior_prob, ae.prior_rank, ae.backoff_steps)

for de in ev.demographic_evals:
    print(de.dim, de.value, de.n_agents, de.tvd, de.wasserstein)

ev.aggregate_summary()  # → dict with all scalar fields
```

### CLI (`run_eval.py`)

```bash
python evals/run_eval.py --all                        # summary table, all simulations
python evals/run_eval.py --recent 5                   # 5 most recent
python evals/run_eval.py --sim-id <sim_id> --detail   # per-agent breakdown + CI table
python evals/run_eval.py --all --format json          # JSON output
python evals/run_eval.py --all --question CLIM9_W89   # filter by question
```

### Summary table columns

| Column | Meaning |
|---|---|
| `valid` | Fraction of agents with a valid stance (target: 1.00) |
| `prior_p` | Mean ATP prior probability of each agent's chosen stance |
| `modal%` | Fraction who chose the modal answer for their demographic cell |
| `top2%` | Fraction whose stance ranked top-2 in their prior |
| `TVD` | Total Variation Distance vs. ATP national prior (lower = better) |
| `Wass` | Normalized Wasserstein distance vs. ATP national prior (lower = better) |
| `cover` | Fraction of answer options chosen by at least one agent |
| `in_CI` | Fraction of ATP prior probabilities inside the simulated 95% Wilson CI |

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Calibration, not held-out | ATP priors and ATP ground truth come from the same dataset. Low TVD means the pipeline reproduces its own training signal, not that it generalises to unseen questions. |
| Compact parquet sparsity | The compact parquet only includes cells with ≥ 30 ATP respondents. Many 3-dim demographic combinations are absent, limiting slice diversity for some questions. |
| Backoff conflation | Agents sharing a fallback prior cell receive identical priors, compressing `prior_prob` variance. Inspect `backoff_steps` to gauge extent. |
| Wide CIs at small n | At n=30, Wilson CIs are ≈ ±18pp. `prior_in_ci_rate = 1.0` means you lack power to detect the divergence, not that the simulation is accurate. |

---

## References

- Suh, J., Jahanparast, E., Moon, S., Kang, M., & Chang, S. (ACL 2025). *Language Model Fine-Tuning on Scaled Survey Data for Predicting Distributions of Public Opinions.* https://aclanthology.org/2025.acl-long.1028/
- Gong, E., Sanders, N. E., & Schneier, B. (2026). *Characterizing the ability of LLMs to recapitulate Americans' distributional responses to public opinion polling questions across political issues.* arXiv:2603.20229.
- Lee, H. & Sobel, M. E. (2024). *The Wasserstein Bipolarization Index.* arXiv:2408.03331.
- Wilson, E. B. (1927). *Probable inference, the law of succession, and statistical inference.* JASA, 22(158), 209–212.
