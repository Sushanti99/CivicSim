# CivicSim Evals

This folder contains the evaluation framework for measuring how accurately and
trustworthily CivicSim agents represent the opinions of real people.

---

## Level 1 — What this does, in plain English

CivicSim works by creating thousands of synthetic "people" — each with an age,
race, income, and occupation drawn from real census data — and then asking an AI
to answer a policy question as each one of them would. The result is a simulated
poll: "here is how a representative sample of Alameda County residents might
respond to this question."

But how do we know the simulation is believable?

That is what this folder answers. It checks the simulation against a real
benchmark: actual survey data collected by the Pew Research Center (called the
American Trends Panel, or ATP). Pew asked tens of thousands of real Americans
these same questions, broken down by age, race, income, and geography. That
gives us ground truth.

The evaluation asks two questions:

1. **Did each individual agent behave plausibly?** If Pew data says that
   middle-income Black women in the West tend to support climate action at a
   rate of roughly 70%, did the AI agent with that profile pick a pro-climate
   answer about 70% of the time — or did it consistently choose something Pew
   says is rare for that group?

2. **Does the overall simulation match the real population?** If you aggregate
   the 50 simulated agents and compare their collective answer distribution to
   what Pew found nationally, how far off is it?

The output is a **trust score from 0 to 100** and a set of readable metrics.
A score above 80 is EXCELLENT, above 65 is GOOD. A score below 35 means the
simulation diverged significantly from real survey data and its outputs should
be interpreted with caution.

The evaluation does *not* claim the simulation is perfect. LLM-generated text
can be overconfident, stylistically homogenous, or subtly biased in ways no
single number captures. But it does give researchers and practitioners a concrete,
data-grounded signal for how much to trust a given run.

---

## Level 2 — How to use it

### Setup

The evals require the same Python environment as the backend.
Activate the `CivicSim_Main` virtual environment before running:

```bash
source /path/to/CivicSim_Main/.venv/bin/activate
```

The priors parquet (`data/atp_priors/policy_priors.parquet`) must exist.
If it does not, build the synthetic version first:

```bash
python scripts/build_atp_priors.py --synthetic
```

### Running

```bash
# Summary table of the 5 most recent simulations
python evals/run_eval.py --recent 5

# Verbose per-agent breakdown for one simulation
python evals/run_eval.py --sim-id 003__region_west__politics_gov__20260512_090228 --detail

# All saved simulations, as JSON (pipe-friendly)
python evals/run_eval.py --all --format json

# Only simulations for a specific ATP question
python evals/run_eval.py --all --question CLIM9_W89
```

### What the output means

#### Summary table

```
sim_id                  Q            N    valid  prior_p  modal%  top2%  TVD   cover  score   grade
003__region_west__...   POL1JB_W92  50    1.00   0.538    0.700   1.000  0.138  1.00   86.7   EXCELLENT
```

| Column | What it measures |
|---|---|
| `valid` | Fraction of agents whose stance was a valid answer option (should be 1.00) |
| `prior_p` | Avg probability the ATP prior assigned to each agent's chosen stance |
| `modal%` | Fraction of agents who chose the *most likely* answer for their demographic |
| `top2%` | Fraction whose stance ranked in the top 2 of their prior |
| `TVD` | Total Variation Distance vs. real ATP national distribution (lower = better) |
| `cover` | Fraction of answer options chosen by at least one agent |
| `score` | Composite trust score [0–100] |
| `grade` | EXCELLENT ≥ 80 · GOOD ≥ 65 · FAIR ≥ 50 · POOR ≥ 35 · LOW < 35 |

#### Detail report (--detail flag)

Adds:
- **Answer Distribution table**: side-by-side ATP prior vs. simulated probabilities per answer option, with a delta column
- **Demographic Group Breakdown**: TVD per demographic slice (age group, race/ethnicity, income, urbanicity) vs. that group's ATP prior
- **Per-agent table**: each agent's chosen stance, the prior probability of that choice, its rank in the prior, and which demographic dimensions were dropped during prior lookup backoff

### Using the evaluator as a Python library

```python
from evals.evaluator import evaluate_sim_id

ev = evaluate_sim_id("003__region_west__politics_gov__20260512_090228")

print(ev.trust_score)              # float in [0, 100]
print(ev.tvd_vs_national)          # TVD vs. Pew national prior
print(ev.modal_agreement_rate)     # fraction choosing modal answer

for ae in ev.agent_evals:
    print(ae.agent_id, ae.stance, ae.prior_prob, ae.prior_rank)

for de in ev.demographic_evals:
    print(de.dim, de.value, de.tvd)
```

### Files

| File | Role |
|---|---|
| `metrics.py` | Pure math functions — TVD, KL divergence, Hellinger distance, prior lookup helpers. No dependencies on the backend. |
| `evaluator.py` | Dataclasses (`AgentEval`, `SimulationEval`) and the core `evaluate_simulation()` function. Loads saved simulations from `data/simulations/` and national priors from the ATP parquet. |
| `run_eval.py` | CLI entry point. Wraps `evaluator.py` with argument parsing and formatted output. |

---

## Level 3 — Methodology and design choices

### What is being measured and why

CivicSim agents are prompted with two sources of information: a demographic
persona (age, race, income, occupation) and an empirical prior distribution —
the real ATP answer-share distribution for that demographic cell. The central
methodological claim is that injecting the prior grounds the LLM and prevents
it from defaulting to its own (frequently centrist, majority-demographic)
training distribution.

This evaluation operationalizes that claim. It measures whether (a) individual
agents respect the prior they were given, and (b) the aggregate output matches
the population-level survey distribution.

### Metric definitions

**Prior adherence (per-agent)**

For each agent $i$ with prior $\pi_i$ and chosen stance $s_i$:

- `prior_prob` = $\pi_i(s_i)$ — the probability the ATP prior assigned to the chosen stance.
- `prior_rank` = rank of $s_i$ in $\pi_i$ sorted by descending probability (rank 1 = modal answer).
- `modal_agreement` = $\mathbf{1}[s_i = \arg\max \pi_i]$
- `expected_log_likelihood` = $\frac{1}{n} \sum_i \log \pi_i(s_i)$ — a calibration score analogous to the log-likelihood of a probabilistic model. Closer to 0 is better; very negative values indicate the LLM frequently chose low-probability answers.

**Aggregate distribution accuracy**

Let $\hat{p}$ be the simulated aggregate distribution (fraction of agents choosing
each answer) and $p^*$ be the national-marginal ATP distribution for the same
question. We report:

- `tvd_vs_national` = $\text{TVD}(p^*, \hat{p}) = \frac{1}{2}\sum_k |p^*(k) - \hat{p}(k)|$
- `kl_vs_national` = $D_\text{KL}(p^* \| \hat{p}) = \sum_k p^*(k) \log \frac{p^*(k)}{\hat{p}(k)}$, with $\varepsilon = 10^{-9}$ smoothing on $\hat{p}$
- `hellinger_vs_national` = $H(p^*, \hat{p}) = \frac{1}{\sqrt{2}} \sqrt{\sum_k (\sqrt{p^*(k)} - \sqrt{\hat{p}(k)})^2}$

TVD is the primary metric because it is interpretable (the maximum difference
in probability any event could have under the two distributions), symmetric,
and bounded. KL is included for researchers who prefer an information-theoretic
framing; Hellinger for those who want a symmetric, bounded alternative to KL.

**Trust score**

$$\text{trust} = 0.15 \cdot v + 0.40 \cdot a + 0.20 \cdot m + 0.25 \cdot d$$

where:
- $v$ = validity rate × 100
- $a$ = (mean_prior_prob / mean_modal_prior_prob) × 100, clipped to [0, 100] — normalized so that always picking the modal answer scores 100, regardless of how concentrated the prior is
- $m$ = modal_agreement_rate × 100
- $d$ = (1 − TVD) × 100

The 40% weight on prior adherence reflects that the core methodological
contribution of CivicSim is prior-grounding; departures from the prior are the
primary failure mode to detect. When the national prior is unavailable (parquet
missing or question not found), the distribution component is dropped and the
remaining three weights are re-scaled to sum to 1.

**Demographic breakdown**

For each dimension in `{age_group, race_eth, income_group, urbanicity}`, agents
are grouped by their post-backoff demographic cell value. The group prior is the
mean of the per-agent priors (already cell-specific after backoff). TVD and
Hellinger are computed between the group's simulated distribution and this
averaged prior. Groups with fewer than 2 agents or with value `ALL` (fully
marginal after backoff) are excluded.

### Limitations and known failure modes

**Small-n instability.** With n=15–50 agents per simulation, sampling variance
dominates. A simulation scoring TVD=0.15 on a 2-answer question (e.g., Approve/
Disapprove) may differ from the true expected TVD by ±0.05–0.10 purely due to
finite sample size. The trust score is more meaningful aggregated across many
runs than interpreted for any single run.

**Synthetic priors.** When the real ATP data is unavailable and the synthetic
priors parquet is used (built via `--synthetic` flag), all metrics measuring
agreement with "real" data are measuring agreement with synthetically generated
distributions, not actual Pew survey data. The framework is structurally correct
but empirically vacuous in that mode. Outputs should be interpreted as
developmental/CI tests only.

**Prior backoff conflation.** When a demographic cell is sparse and the prior
lookup falls back to a more marginal distribution (e.g., dropping `income_group`
and `race_eth` to use only the regional prior), all agents sharing that fallback
cell receive the same prior. Per-agent `prior_prob` values become identical
across those agents, which artificially compresses the distribution of
`prior_prob` and inflates apparent prior adherence for that group. The
`backoff_steps` field on each `AgentEval` exposes exactly which dimensions were
dropped.

**Modal bias.** `modal_agreement_rate` is not a pure goodness-of-fit measure.
On a 2-answer binary question with prior (0.60, 0.40), the optimal stochastic
agent choosing from the prior would achieve `modal_agreement_rate` ≈ 0.60, not
1.0. A rate near 0.70 could mean the LLM over-concentrates on the modal answer
relative to what the prior warrants. The metric is most interpretable alongside
the answer distribution table, which shows whether the simulated distribution is
skewed relative to the prior.

**LLM provider variance.** The `mock` provider samples directly from the prior,
producing very high prior adherence by construction. Real LLM providers (OpenAI,
Anthropic) introduce model-specific biases. Evaluation results are not comparable
across providers without controlling for this.

**Coverage vs. calibration.** `answer_coverage` measures whether the simulation
explored the full answer space, not whether it explored it at the right
frequencies. Full coverage (1.0) is necessary but not sufficient for a
well-calibrated simulation.

### Relationship to prior work

The evaluation design follows the "LLM-as-survey-respondent" literature
(Argyle et al. 2023; Santurkar et al. 2023; Bisbee et al. 2023). Those works
measure alignment between LLM outputs and survey distributions at the population
level using TVD and correlation coefficients. This framework extends that approach
by also measuring per-agent prior adherence — specifically whether injecting an
empirical prior (the core CivicSim intervention) causes individual agents to
behave consistently with that prior, which is the causal claim the system makes.

The use of ATP data as the reference distribution is consistent with the main
CivicSim research pipeline in `CivicSim_Main/`. The ablation experiments there
(Experiments 1–3) provide the empirical motivation for the prior-injection
mechanism this evaluation is designed to audit.
