# CivicSim Evals

Evaluation framework for measuring how accurately CivicSim agents reproduce
real survey opinion distributions from the Pew American Trends Panel (ATP).

---

## Comparative Evaluation — `eval_table.py`

> **The primary benchmark.** Compares CivicSim against two naive LLM baselines
> across multiple policy domains, question types, and demographic slices.

### What it does

For each *(domain × question × demographic slice)* combination, the eval runs
three conditions against the same S3 ATP ground truth:

| Condition | Description |
|---|---|
| **CivicSim** | Prior-grounded: each agent's stance is pre-sampled from their demographic-specific ATP prior, then confirmed by Claude Haiku |
| **Naive Anthropic** | Claude Haiku with persona only — no ATP prior |
| **Naive OpenAI** | GPT-4o-mini with persona only — no ATP prior |

Ground truth is computed from the full S3 ATP dataset (`s3://civicsim-data/parquet/atp_2021_2024_final.parquet`), filtered to the demographic slice and weighted by respondent weight.

### Key design decisions

**Demographic-specific marginal prior** — `_compact_marginal_prior()` computes each agent's prior by averaging all compact-parquet rows matching the agent's available dims (age_group, race_eth, income_group). This gives real demographic conditioning without requiring a full 8-dim cell match.

**Pre-sampled stance** — Each CivicSim agent's answer is sampled from their demographic prior distribution *before* the LLM call. The LLM then confirms that stance. This forces the aggregate distribution to track the prior rather than collapsing to the LLM's modal preference.

### Results (21 rows across 5 domains)

CivicSim consistently and significantly outperforms both naive baselines on TVD:

| Domain | CivicSim TVD | Naive Anthropic TVD | Naive OpenAI TVD |
|---|---|---|---|
| Economy (MINWAGE) | 0.12 – 0.28 | 0.41 – 0.66 | 0.33 – 0.48 |
| Economy (INFRASTRUC) | 0.05 – 0.21 | 0.43 – 0.47 | 0.43 – 0.47 |
| Environment (CLIM9) | 0.09 – 0.21 | 0.56 – 0.62 | 0.29 – 0.50 |
| Family/Society (ABORTLGL) | 0.06 – 0.25 | 0.55 – 0.71 | 0.31 – 0.48 |
| Immigration (AFG21) | 0.15 – 0.21 | 0.63 – 0.74 | 0.50 – 0.67 |
| Politics/Gov (GUNPRIORITY) | 0.05 – 0.14 | 0.44 – 0.87 | 0.49 – 0.55 |
| Politics/Gov (POL1JB) | 0.05 – 0.24 | 0.45 – 0.57 | 0.32 – 0.50 |

### How to run

```bash
# Prerequisites: fill in .env (see .env.example)
# ANTHROPIC_API_KEY, OPENAI_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# Run the full eval (~21 rows, ~1890 LLM calls, ~$0.57)
python evals/eval_table.py

# Outputs written to:
#   evals/results/eval_table.parquet
#   evals/results/eval_report.md
#   evals/results/eval_report.html
```

**Configuration (via `.env` or environment variables):**

| Variable | Default | Description |
|---|---|---|
| `EVAL_N_AGENTS` | `30` | Agents per condition per row |
| `EVAL_D_SLICES` | `3` | Demographic slices per question |
| `EVAL_Q_PER_DOMAIN` | `2` | Questions per domain |

### Reading the parquet output

```python
import pandas as pd
df = pd.read_parquet("evals/results/eval_table.parquet")

# Columns: domain, question_id, slice_str, gt_dist,
#          civicsim_dist, naive_anthropic_dist, naive_openai_dist,
#          civicsim_tvd, civicsim_kl, civicsim_hellinger, civicsim_wasserstein,
#          naive_anthropic_tvd, ..., naive_openai_tvd, ...
```

---

## Single-Simulation Evaluator — `evaluator.py` / `run_eval.py`

> **Per-simulation diagnostics.** Evaluates one saved simulation against the
> ATP national prior, with per-agent breakdowns and demographic group analysis.

---

## Level 1 — Plain English

> **Who this is for:** policymakers, stakeholders, or anyone who just wants
> to know whether to trust a simulation's results.

### What does CivicSim do?

CivicSim creates a synthetic population of people — agents — sampled from real
census data to match a given geography (e.g. the U.S. West region). Each agent
gets a demographic profile (age, race, income, region) and is then asked a
policy question by a language model. The model answers as if it *were* that
person.

### What does the eval check?

The eval compares CivicSim's synthetic answers against **real Pew Research ATP
poll results** for the same question. If the simulation is working well, the
distribution of agent answers should look like the real poll.

### How to read the results (sim 001 example)

**Question:** "How much is climate change currently affecting your local community?"
**Location:** U.S. West Region · **50 agents**

| Answer option | Real poll (ATP) | CivicSim simulation |
|---|---|---|
| Some | 40.3% | 38.0% |
| Not too much | 27.3% | 30.0% |
| A great deal | 17.2% | 20.0% |
| Not at all | 15.2% | 12.0% |

The simulation is very close to the real poll. The largest gap is 3 percentage
points ("Some": 40.3% real vs. 38.0% simulated).

### The headline number: prior-in-CI rate

With only 50 agents there is statistical sampling uncertainty — just like a
real poll with 50 respondents. The eval accounts for this by computing a
**95% confidence interval** for each answer option's simulated proportion.

> **prior-in-CI rate = 1.00 (4/4)** means all four ATP real-poll percentages
> fall inside their simulated confidence intervals. The simulation is
> *statistically indistinguishable* from the real poll at this sample size.

A rate of **1.0** is ideal. A rate below **0.5** suggests the simulation is
systematically off — the LLM may be biased toward certain answers.

### Other things the eval checks

| Signal | Sim 001 | Means |
|---|---|---|
| Validity | 100% | Every agent gave a real answer option (no hallucinations) |
| Modal agreement | 38% | 19/50 agents picked the single most likely answer for their demographic group |
| Top-2 rate | 68% | 34/50 agents picked one of the two most likely answers |
| TVD vs. poll | 0.055 | Only 5.5% of probability mass is misallocated across answer options |
| Wasserstein | 0.020 | Near-zero — the small errors are between adjacent answer options, not extreme reversals |

---

## Level 2 — Analyst

> **Who this is for:** social scientists, policy researchers, or data analysts
> who want to understand what each metric means and how to interpret results.

### Metrics reference

| Metric | Threshold | Interpretation |
|---|---|---|
| `validity_rate` | = 1.00 | Fraction of agents that chose a real answer option. Anything below 1.0 means the LLM generated text that didn't match any option. |
| `mean_prior_prob` | ≥ 0.30 | Average probability the ATP prior assigned to each agent's chosen stance. Low values mean the LLM is frequently choosing low-probability answers for that demographic. |
| `modal_agreement_rate` | ≥ 0.35 | Fraction who chose the single most probable answer for their specific demographic cell. |
| `top2_rate` | ≥ 0.60 | Fraction who chose one of the top-2 most probable answers. Looser than modal — captures plausible choices. |
| `expected_log_likelihood` | closer to 0 | Mean log P(stance). -1.31 ≈ average probability of 0.27. |
| `tvd_vs_national` | ≤ 0.15 | Total Variation Distance: half the sum of absolute differences between simulated and real distributions. 0 = perfect match, 1 = completely wrong. |
| `wasserstein_vs_national` | ≤ 0.10 | Normalized Earth Mover's Distance. Like TVD but respects ordinal ordering of response options — a near-miss (moving mass one step) costs less than a large reversal. Preferred for Likert-scale questions. |
| `answer_coverage` | ≥ 0.80 | Fraction of answer options chosen by at least one agent. Low coverage means the LLM is collapsing answers. |
| `prior_in_ci_rate` | = 1.00 | Fraction of answer options whose real ATP probability falls inside the simulated 95% Wilson confidence interval. This is the primary calibration signal. |
| `wasserstein_vs_national` | ≤ 0.10 | Normalized Earth Mover's Distance (NEMD) vs. ATP national prior. Respects ordinal response order; preferred for Likert questions. |

### The prior-in-CI test explained

With $n$ agents, the simulated proportion $\hat{p}_k$ for answer $k$ has
statistical uncertainty. The Wilson 95% CI quantifies this uncertainty. We
then ask: does the real ATP probability $p_k$ fall inside that interval?

If **all** ATP probabilities fall inside the CIs, the simulation is consistent
with the real poll — we cannot reject the null hypothesis that the simulation
is drawn from the same distribution. This does *not* mean the simulation is
perfect; it means we lack statistical power to detect the difference at that
sample size.

With n=50 agents, CIs are approximately ±13 percentage points. Running
n=200 agents narrows CIs to ±7pp and makes the test more discriminating.

### The backoff system and what it means for metrics

Not every demographic combination has ATP data. When an agent's full
demographic profile (age × race × income × education × region × …) has no
matching row in the ATP parquet, the system drops dimensions one at a time
until it finds data. This is recorded in `backoff_steps`.

In sim 001, all 50 agents show `backoff_steps: [income_group, race_eth]`,
meaning ATP data was available for their age and region but not the specific
income × race combination. They all share the same regional marginal prior.
This compresses `prior_prob` variation and may slightly inflate modal agreement
rate — a known limitation.

### Wasserstein vs. TVD for opinion questions

TVD treats answer categories as exchangeable: shifting mass from "Not at all"
to "Some" (one step) is penalized identically to shifting it all the way to
"A great deal" (three steps). On Likert-scale questions this is wrong —
near-miss distributional errors should cost less than large reversals.

The Normalized Earth Mover's Distance (NEMD, a.k.a. Wasserstein-1 / (K−1))
accounts for ordinal structure. In sim 001:
- TVD = 0.055 — 5.5% mass misallocated
- NEMD = 0.020 — the errors are between adjacent positions, a much smaller
  "transport cost"

This methodology follows Suh, Jahanparast, Moon, Kang & Chang (ACL 2025)
and Gong, Sanders & Schneier (arXiv 2603.20229, 2026), who use NEMD as their
primary metric for LLM–human opinion distribution comparison.

### Demographic breakdown

The eval also checks whether the simulation is accurate within subgroups.
Agents are grouped by `age_group`, `race_eth`, `income_group`, and
`urbanicity`. For each group with ≥2 agents, TVD and Wasserstein are computed
between the group's simulated distribution and the average group prior.
Groups with value `"ALL"` (fully marginal after backoff) are excluded.

---

## Level 3 — Technical / Developer

> **Who this is for:** developers, ML engineers, and researchers who want to
> understand the code, extend the eval, or replicate results.

### Data flow

```
data/simulations/<sim_id>/
  _meta.json          → question_id, location, n, selected_dims
  _summary.json       → aggregate distribution of stances
  agent_0000.json     → {prior, stance, rationale, used_filter, backoff_steps}
  agent_0001.json
  ...

data/atp_priors/policy_priors.parquet
  → national marginal row (all demographic dims = "ALL") = ground truth
```

### Code structure

| File | Role |
|---|---|
| `metrics.py` | Pure math — no backend dependencies. Functions: `total_variation_distance`, `kl_divergence`, `wasserstein_distance`, `prior_prob_of_stance`, `prior_rank_of_stance`, `modal_answer`, `stances_to_distribution`, `expected_log_likelihood`, `wilson_ci`, `answer_cis`, `prior_in_ci_rate`. |
| `evaluator.py` | Dataclasses (`AgentEval`, `DemographicGroupEval`, `SimulationEval`), `evaluate_simulation()`, `evaluate_sim_id()`, `load_national_prior()`. Reads simulation data from the backend store and the priors parquet. |
| `run_eval.py` | CLI entry point. Argument parsing, table/JSON formatting, per-metric pass/warn/fail flags. |
| `eval_table.py` | Comparative benchmark — CivicSim vs. Naive Anthropic vs. Naive OpenAI across domains × questions × demographic slices. |

### Step-by-step walkthrough (sim 001: CLIM9_W89, region_west, n=50)

#### Step 1 — Load the simulation

`evaluate_sim_id("001__region_west__environment_climate__20260514_013000")` reads
every `agent_XXXX.json` file. Each contains:

```json
{
  "prior": [
    {"answer_label": "Some",         "prob": 0.4045},
    {"answer_label": "Not too much", "prob": 0.2511},
    {"answer_label": "A great deal", "prob": 0.2189},
    {"answer_label": "Not at all",   "prob": 0.1255}
  ],
  "stance": "Not too much",
  "backoff_steps": ["income_group", "race_eth"]
}
```

#### Step 2 — Load the ATP national prior (ground truth)

`load_national_prior("CLIM9_W89")` queries the parquet for the row where every
demographic dimension equals `"ALL"` — the fully marginal national distribution.

```
national_prior = {
  "Some":         0.403,
  "Not too much": 0.273,
  "A great deal": 0.172,
  "Not at all":   0.152,
}
```

#### Step 3 — Per-agent metrics

For each agent (from `metrics.py`):

```python
prior_prob   = prior_prob_of_stance(stance, prior)     # P(chosen answer | cell)
prior_rank   = prior_rank_of_stance(stance, prior)     # 1 = modal
modal_agree  = (stance == modal_answer(prior))
```

Example counts for n=50:
- 19 agents chose "Some" (P≈0.40, rank 1 — modal ✓)
- 15 chose "Not too much" (P≈0.25, rank 2)
- 10 chose "A great deal" (P≈0.22, rank 3)
- 6 chose "Not at all" (P≈0.13, rank 4)

#### Step 4 — Simulation-level aggregation

```python
validity_rate          = 50/50 = 1.0000
mean_prior_prob        = Σ P(stance_i) / 50 = 0.2879   # [WARN: < 0.30]
modal_agreement_rate   = 19/50 = 0.3800
top2_rate              = (19+15)/50 = 0.6800
expected_log_likelihood = mean(log P(stance_i)) = -1.3114

simulated_aggregate = {
  "Some":         19/50 = 0.380,
  "Not too much": 15/50 = 0.300,
  "A great deal": 10/50 = 0.200,
  "Not at all":    6/50 = 0.120,
}
```

#### Step 5 — TVD and Wasserstein

**TVD:**

$$\text{TVD} = \frac{1}{2} \sum_k |p^*_k - \hat{p}_k|
= \frac{1}{2}(|0.403 - 0.380| + |0.273 - 0.300| + |0.172 - 0.200| + |0.152 - 0.120|)
= \frac{1}{2}(0.110) = 0.0549$$

**Normalized Wasserstein (NEMD):**

Sort categories by descending ATP prior:
[Some (0), Not too much (1), A great deal (2), Not at all (3)]

Accumulate CDF gaps over $K-1 = 3$ transitions:

| i | Category | CDF_P | CDF_Q | gap |
|---|---|---|---|---|
| 0 | Some | 0.403 | 0.380 | 0.023 |
| 1 | Not too much | 0.676 | 0.680 | 0.004 |
| 2 | A great deal | 0.848 | 0.880 | 0.032 |

$$W_1 = 0.023 + 0.004 + 0.032 = 0.059
\quad \Rightarrow \quad
\text{NEMD} = \frac{0.059}{K-1} = \frac{0.059}{3} = 0.0196$$

The NEMD (0.0196) is lower than TVD (0.0549) because the distributional errors
are one-step ordinal shifts ("Not at all" mass moved to "A great deal" — 2
steps), not extreme reversals. TVD is blind to this structure; NEMD captures it.

**Code** (`metrics.py:wasserstein_distance`):
```python
all_keys = sorted(p | q, key=lambda k: -p.get(k, 0.0))  # descending ATP order
cdf_p = cdf_q = w1 = 0.0
for i in range(len(all_keys) - 1):
    cdf_p += p_arr[i]; cdf_q += q_arr[i]
    w1 += abs(cdf_p - cdf_q)
return w1 / (len(all_keys) - 1)  # normalize to [0, 1]
```

#### Step 6 — Wilson 95% confidence intervals

For each answer option $k$ with $k_{\text{count}}$ agents choosing it out of $n = 50$:

$$\hat{p} = k_{\text{count}} / n, \quad z = 1.96$$

$$\text{CI} = \frac{\hat{p} + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + z^2/n}$$

| Answer | k | Simulated | 95% CI | ATP Prior | In CI? |
|---|---|---|---|---|---|
| Some | 19 | 0.380 | [0.259, 0.518] | 0.403 | ✓ |
| Not too much | 15 | 0.300 | [0.191, 0.438] | 0.273 | ✓ |
| A great deal | 10 | 0.200 | [0.112, 0.330] | 0.172 | ✓ |
| Not at all | 6 | 0.120 | [0.056, 0.238] | 0.152 | ✓ |

`prior_in_ci_rate = 4/4 = 1.00`

All ATP priors fall inside the CIs. At n=50 the CIs are wide (~±13pp), so this
result does not imply the simulation is perfect — only that the divergence is
not yet statistically detectable. Increase $n$ to tighten CIs and gain power.

**Code** (`metrics.py:wilson_ci`):
```python
z2 = z * z
centre = (p_hat + z2 / (2 * n)) / (1 + z2 / n)
margin = (z / (1 + z2 / n)) * math.sqrt(p_hat * (1 - p_hat) / n + z2 / (4 * n * n))
return (max(0.0, centre - margin), min(1.0, centre + margin))
```

#### Step 7 — Demographic breakdown

Agents are grouped by `age_group`, `race_eth`, `income_group`, `urbanicity`.
Groups with value `"ALL"` (fully marginal — dimensions dropped during backoff)
are excluded. For each remaining group:

```python
# Average per-agent priors → representative group prior
prior_avg = {opt: mean(agent.prior[opt]) for opt in answer_options}
tvd      = total_variation_distance(prior_avg, simulated_group)
wasserstein = wasserstein_distance(prior_avg, simulated_group)
```

In sim 001, all agents backed off to the same regional marginal (backoff on
`income_group` + `race_eth`), so `used_filter` values are uniform. Most
demographic groups end up with value `"ALL"` and are excluded. This reflects
the data sparsity of the ATP parquet for the West region.

### Python API

```python
from evals.evaluator import evaluate_sim_id

ev = evaluate_sim_id("001__region_west__environment_climate__20260514_013000")

# Aggregate metrics
ev.prior_in_ci_rate           # float: fraction of ATP priors inside CI (1.0 = all)
ev.confidence_intervals       # dict[str, (float, float)]: 95% CI per answer option
ev.tvd_vs_national            # TVD vs. ATP national prior (lower = better)
ev.kl_vs_national             # KL divergence vs. ATP national prior
ev.wasserstein_vs_national    # NEMD vs. ATP national prior (lower = better)
ev.modal_agreement_rate       # fraction choosing modal answer
ev.top2_rate                  # fraction whose stance ranked top-2 in their prior
ev.answer_coverage            # fraction of answer options used by at least one agent
ev.expected_log_likelihood    # mean log P(stance | prior)

# Per-agent breakdown
for ae in ev.agent_evals:
    print(ae.agent_id, ae.stance, ae.prior_prob, ae.prior_rank, ae.backoff_steps)

# Demographic group breakdown
for de in ev.demographic_evals:
    print(de.dim, de.value, de.n_agents, de.tvd, de.wasserstein)

# Full summary dict
ev.aggregate_summary()
```

### CLI

```bash
# Summary table — all simulations
python evals/run_eval.py --all

# Verbose per-agent detail with CI table
python evals/run_eval.py --sim-id 001__region_west__environment_climate__20260514_013000 --detail

# All simulations, JSON output
python evals/run_eval.py --all --format json

# Filter to one question
python evals/run_eval.py --all --question CLIM9_W89

# Most recent 5
python evals/run_eval.py --recent 5
```

### How to extend

**Add a metric:** implement a pure function in `metrics.py`, add a field to
`SimulationEval` in `evaluator.py`, call it in `evaluate_simulation()`, add it
to `aggregate_summary()`, then add a row in `print_detail_report()` in
`run_eval.py`.

**Change CI confidence level:** pass `confidence=0.99` to `wilson_ci()` /
`answer_cis()`.

**Change the ordinal ordering:** `wasserstein_distance` currently sorts
categories by descending reference probability. For questions with an explicit
Likert scale (Strongly Agree → Strongly Disagree), you can pass a pre-sorted
`all_keys` list instead.

### Known limitations

| Limitation | Detail |
|---|---|
| Calibration, not held-out | ATP priors and ATP ground truth come from the same dataset. Low TVD means the pipeline reproduces its own training signal — not necessarily unseen questions. |
| Backoff conflation | Agents sharing a backoff cell receive identical priors, compressing `prior_prob` variation and inflating modal agreement rates for that group. Inspect `backoff_steps` to gauge extent. |
| Wide CIs at small n | At n=50, Wilson CIs are ≈±13pp. `prior_in_ci_rate = 1.0` does not mean the simulation is accurate — it means you lack statistical power to detect the divergence. Run n≥200 for discriminating tests. |
| Mock provider | The `mock` LLM samples directly from the prior. Scores are structurally valid but not comparable to real LLM scores. |
| Synthetic priors | If the parquet was built with `--synthetic`, all distribution metrics are relative to fabricated numbers. |

### References

- Suh, J., Jahanparast, E., Moon, S., Kang, M., & Chang, S. (ACL 2025). *Language Model Fine-Tuning on Scaled Survey Data for Predicting Distributions of Public Opinions.* https://aclanthology.org/2025.acl-long.1028/
- Gong, E., Sanders, N. E., & Schneier, B. (2026). *Characterizing the ability of LLMs to recapitulate Americans' distributional responses to public opinion polling questions across political issues.* arXiv:2603.20229.
- Lee, H. & Sobel, M. E. (2024). *The Wasserstein Bipolarization Index: A New Measure of Public Opinion Polarization.* arXiv:2408.03331.
- Jiang, Z. et al. (2026). *Simulating social perception with large language models.* Journal of Chinese Governance.
- Panaretos, V. M. & Zemel, Y. (2019). *Statistical aspects of Wasserstein distances.* Annual Review of Statistics and Its Application, 6, 405–431.
- Wilson, E. B. (1927). *Probable inference, the law of succession, and statistical inference.* Journal of the American Statistical Association, 22(158), 209–212.


---

## What is being evaluated

Each CivicSim simulation produces a set of agents. Each agent has:
- A **demographic profile**: age, race, income, occupation (sampled from census data).
- A **prior distribution**: the real ATP (American Trends Panel) answer-share for that agent's demographic cell and geography — e.g., "West-region adults aged 18–29 with income above $100k chose Approve 59.6% / Disapprove 40.4%".
- A **stance**: the answer an LLM chose for that agent after being shown the prior.

The evaluation checks two things:
1. **Prior adherence** — did the LLM's chosen stance respect the empirical prior it was given?
2. **Aggregate accuracy** — does the distribution of all stances across the full agent population match the real national ATP distribution for the same question?

---

## Data flow

```
data/simulations/<sim_id>/
  _meta.json          → question_id, location, n, selected_dims
  _summary.json       → aggregate distribution of stances
  agent_0000.json     → per-agent: demographics, prior, stance, backoff_steps
  agent_0001.json
  ...

data/atp_priors/policy_priors.parquet
  → national marginal row (all demographic dims = "ALL") used as ground truth
```

`evaluator.py` loads both. For each agent file it computes per-agent metrics.
For the simulation as a whole it computes aggregate metrics against the ATP
national marginal.

---

## How it works, step by step

### Step 1 — Load the simulation

`evaluate_sim_id(sim_id)` in `evaluator.py` reads every `agent_XXXX.json` file
from `data/simulations/<sim_id>/`. Each file contains the agent's `prior` list,
`stance` string, and `backoff_steps` list:

```json
{
  "prior": [{"answer_label": "Approve", "prob": 0.596}, ...],
  "stance": "Disapprove",
  "backoff_steps": ["income_group", "race_eth", "age_group"]
}
```

### Step 2 — Load the ground truth

`load_national_prior(question_id)` queries `policy_priors.parquet` for the row
where every demographic dimension equals `"ALL"` — the fully-marginal national
distribution. This is the ATP-observed answer distribution across all
respondents nationally, regardless of demographics. It is the ground truth for
the aggregate accuracy check.

It tries pandas first, then duckdb as a fallback. If neither is installed,
aggregate accuracy metrics are reported as `N/A`.

### Step 3 — Per-agent evaluation

For each agent, `evaluator.py` computes (implemented in `metrics.py`):

| What is computed | How |
|---|---|
| `stance_valid` | Is `stance` one of the answer option labels in the prior list? |
| `prior_prob` | `prior_prob_of_stance(stance, prior)` — the probability the ATP prior assigned to the chosen stance. A 50/50 prior gives at most 0.50; a concentrated prior can give 0.80+. |
| `prior_rank` | `prior_rank_of_stance(stance, prior)` — 1 if the agent chose the most likely answer, 2 if second-most, etc. |
| `modal_agreement` | `stance == argmax(prior)` — True if the agent chose the single most probable answer for their demographic cell. |
| `backoff_steps` | Copied directly from the agent file — which demographic dimensions were dropped when the prior lookup found no data. |

### Step 4 — Simulation-level aggregation

Across all agents:

| Metric | Computation |
|---|---|
| `validity_rate` | `count(stance_valid) / n` |
| `mean_prior_prob` | `mean(prior_prob_i)` across all agents |
| `modal_agreement_rate` | `count(modal_agreement) / n` |
| `top2_rate` | `count(prior_rank ≤ 2) / n` |
| `expected_log_likelihood` | `mean(log(prior_prob_i))` — calibration score; closer to 0 is better |
| `simulated_aggregate` | `count(stance == k) / n` for each answer option k |

### Step 5 — Aggregate accuracy vs. ground truth

`simulated_aggregate` (the simulated poll) is compared to `national_prior` (the
real ATP poll) using three distance metrics from `metrics.py`:

**Total Variation Distance (primary metric)**

$$\text{TVD} = \frac{1}{2} \sum_k \left| p^*_k - \hat{p}_k \right|$$

where $p^*$ is ATP national, $\hat{p}$ is simulated. Bounded $[0, 1]$.
TVD = 0.10 means no single answer option can differ by more than 10 percentage
points between the two distributions.

**KL Divergence** (information-theoretic view)

$$D_\text{KL}(p^* \| \hat{p}) = \sum_k p^*_k \log \frac{p^*_k}{\hat{p}_k + \varepsilon}$$

where $\varepsilon = 10^{-9}$ prevents log(0). Asymmetric — penalises answers
the simulation under-represents relative to ATP.

**Hellinger Distance** (symmetric bounded alternative)

$$H = \frac{1}{\sqrt{2}} \sqrt{\sum_k \left(\sqrt{p^*_k} - \sqrt{\hat{p}_k}\right)^2}$$

Bounded $[0, 1]$, symmetric, and less sensitive to near-zero probabilities than KL.

### Step 6 — Demographic group breakdown

Agents are grouped by their post-backoff cell value for each of `age_group`,
`race_eth`, `income_group`, and `urbanicity`. For each group with at least
2 agents and a non-`"ALL"` value:

- The **group prior** is the mean of per-agent priors within the group (they
  share the same prior when they share the same backoff cell).
- The **group simulated distribution** is the stance distribution within the group.
- TVD and Hellinger are computed between them.

Groups with value `"ALL"` are excluded — they are fully marginal after backoff,
meaning no demographic conditioning occurred for that dimension.

---

## Files

| File | Role |
|---|---|
| `metrics.py` | Pure math: `total_variation_distance`, `kl_divergence`, `hellinger_distance`, `prior_prob_of_stance`, `prior_rank_of_stance`, `modal_answer`, `stances_to_distribution`, `expected_log_likelihood`. No backend dependency. |
| `evaluator.py` | Dataclasses (`AgentEval`, `DemographicGroupEval`, `SimulationEval`), `evaluate_simulation()`, `evaluate_sim_id()`, `load_national_prior()`. Reads agent JSON files and the priors parquet directly. |
| `run_eval.py` | CLI. Wraps `evaluator.py` with argument parsing, table formatting, JSON output, and per-metric pass/warn/fail flags. |

---

## Usage

```bash
# Summary table — 5 most recent simulations
python evals/run_eval.py --recent 5

# Verbose per-agent detail for one simulation
python evals/run_eval.py --sim-id 003__region_west__politics_gov__20260512_090228 --detail

# All simulations, JSON output
python evals/run_eval.py --all --format json

# Filter to one question ID
python evals/run_eval.py --all --question CLIM9_W89
```

### Python API

```python
from evals.evaluator import evaluate_sim_id

ev = evaluate_sim_id("003__region_west__politics_gov__20260512_090228")

print(ev.tvd_vs_national)          # TVD vs. ATP national prior
print(ev.prior_in_ci_rate)         # fraction of ATP priors inside CI
print(ev.modal_agreement_rate)     # fraction choosing modal answer
print(ev.expected_log_likelihood)  # mean log P(stance | prior)

for ae in ev.agent_evals:
    print(ae.agent_id, ae.stance, ae.prior_prob, ae.prior_rank, ae.backoff_steps)

for de in ev.demographic_evals:
    print(de.dim, de.value, de.n_agents, de.tvd)
```

### Summary table columns

| Column | Meaning |
|---|---|
| `valid` | Fraction of agents with a valid stance (should be 1.00) |
| `prior_p` | Mean ATP prior probability of each agent's chosen stance |
| `modal%` | Fraction who chose the most probable answer for their demographic cell |
| `top2%` | Fraction whose stance ranked top-2 in their prior |
| `TVD` | Total Variation Distance vs. ATP national (lower = better, 0 = identical) |
| `cover` | Fraction of answer options chosen by at least one agent |
| `in_CI` | Fraction of ATP prior probabilities inside the simulated 95% Wilson CI (1.00 = all consistent) |

---

## Known limitations

**Calibration check, not a held-out test.** The ATP priors parquet was compiled
from the same ATP data used here as ground truth. Low TVD means the pipeline
reproduces the training signal — not that it generalises to unseen questions.
A genuine held-out test requires rebuilding priors from early ATP waves and
testing against later waves.

**Synthetic priors mode.** When `policy_priors.parquet` was built with
`--synthetic`, all distribution metrics measure agreement with fabricated
numbers. Results are structurally valid but empirically meaningless.

**Prior backoff conflation.** When a demographic cell is sparse, the prior
lookup drops dimensions (recorded in `backoff_steps`). Agents sharing the
same fallback cell receive identical priors, which compresses the distribution
of `prior_prob` and overstates apparent prior adherence for that group. The
`backoff_steps` field on each `AgentEval` shows exactly which dimensions were
dropped.

**Small-n instability.** At n=15–50 agents, sampling variance is large. TVD
on a binary question can vary by ±0.05–0.10 purely by chance. Trust scores
are more meaningful aggregated across many runs than for a single run.

**Mock provider.** The `mock` LLM provider samples directly from the prior,
producing very high prior adherence by construction. Scores from the mock
provider are not comparable to real LLM provider scores.
