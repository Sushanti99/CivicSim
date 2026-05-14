# CivicSim — End-to-End Walkthrough

A concrete trace of one simulation from user input to final output,
using real data from simulation `001__region_west__environment_climate__20260514_013000`.

---

## The request

A user opens the simulate page and fills in:

| Field | Value |
|---|---|
| Location | West Region |
| Domain | Environment & Climate |
| Question | *How much is climate change currently affecting your local community?* |
| N agents | 50 |
| Demographic dims | `race_eth`, `income_group`, `F_CREGION` |

This becomes a `POST /api/simulate` request:

```json
{
  "location": "region_west",
  "domain": "environment_climate",
  "question_id": "CLIM9_W89",
  "n": 50,
  "selected_dims": ["race_eth", "income_group", "F_CREGION"]
}
```

---

## Step 1 — Sample N agents from census data

`civicsim_agents.sample_agents("region_west", n_agents=50)` reads four
marginal distributions from `data/locations/region_west/*.csv` (sourced from
the American Community Survey):

- Age distribution
- Race / ethnicity distribution
- Income distribution
- Occupation distribution

With `diverse=True` (the default), each axis is allocated by largest-remainder
so the 50-agent sample exactly matches the population marginals. The four axes
are then independently shuffled to produce 50 (age, race, income, occupation)
tuples. No two axes are jointly conditioned — this keeps the sampler tractable
while preserving each marginal.

Two of the 50 agents sampled:

```
Agent 1:  age=18-29   race=Other   income=90000_to_100000   occupation=Civilian employed
Agent 6:  age=30-49   race=White   income=30000_to_40000    occupation=Computer/engineering
```

---

## Step 2 — Look up the ATP prior for each agent

For each agent, `opinion_prior.lookup_distribution()` queries
`data/atp_priors/policy_priors.parquet` for the demographic cell that matches
the agent's profile on the user-selected dimensions (`race_eth`, `income_group`,
`F_CREGION`).

### What the parquet contains

Each row is a `(question_id × demographic_cell × answer_option)` triple with
a probability:

```
question_id  | F_CREGION | race_eth | income_group | answer_label | prob
CLIM9_W89    | West      | Other    | above_100000 | Some         | ???
CLIM9_W89    | West      | White    | 30000_to_40000 | Some       | ???
...
CLIM9_W89    | West      | ALL      | ALL          | Some         | 0.405
```

### The backoff

**Agent 1** maps to the cell `{F_CREGION: West, race_eth: Other, income_group: above_100000}`.
The system queries for that exact cell. No rows found (sparse).

It drops `income_group` (least-informative first) → tries `{West, Other, ALL}`. Still no rows.

It drops `race_eth` → tries `{West, ALL, ALL}`. **Rows found.**

```
backoff_steps: ["income_group", "race_eth"]
used_filter:   {F_CREGION: "West", everything else: "ALL"}
```

**Agent 6** maps to `{F_CREGION: West, race_eth: White, income_group: 30000_to_40000}`.
Same backoff path, same result — the synthetic priors parquet only has region-level
data for this question.

Both agents end up with the **West region marginal prior**:

```
Some         40.5%
Not too much 25.1%
A great deal 21.9%
Not at all   12.6%
```

> With real ATP data (not synthetic), finer-grained cells would be populated
> and the backoff chain would often stop at the income or race level.

---

## Step 3 — Build the LLM prompt for each agent

`llm_client._build_user_prompt()` assembles a prompt for each agent by
combining the persona, the question, the answer options, and the ATP prior.

**Prompt for Agent 1:**

```
Your demographics:
  Age bracket: 18-29
  Race/ethnicity: Other
  Income bracket: 90000_to_100000
  Occupation: Civilian employed population 16 years and over

Question: How much is climate change currently affecting your local community?

Answer options (pick exactly one, verbatim):
  - A great deal
  - Not too much
  - Some
  - Not at all

In recent national polling, people in your demographic group answered as follows:
  - Some: 41%
  - Not too much: 25%
  - A great deal: 22%
  - Not at all: 13%

Respond as one such person. Output strict JSON:
{"stance": <one of the options>, "rationale": <one sentence>}.
```

The system prompt (sent separately) tells the model to stay in character and
respond only in that JSON format.

---

## Step 4 — LLM responds for each agent

The LLM (or mock provider) returns a JSON object. `_parse_reply()` extracts the
stance and validates it against the answer options. If the model returns a
string not in the list, it is snapped to the closest case-insensitive match.

**Agent 1 response:**
```json
{"stance": "Not too much", "rationale": "As a 18-29 other civilian employed, this answer matches what people in my situation tend to say."}
```

**Agent 6 response:**
```json
{"stance": "Some", "rationale": "As a 30-49 white computer/engineering worker, this answer matches what people in my situation tend to say."}
```

Both stances are valid answer options. Each response is written to
`data/simulations/001__…/agent_0000.json` and `agent_0005.json`.

---

## Step 5 — Aggregate across all 50 agents

`aggregator.aggregate_stances()` counts stances and normalises:

```
Stance          Count   Probability
────────────────────────────────────
Some              19      38%
Not too much      15      30%
A great deal      10      20%
Not at all         6      12%
```

Written to `data/simulations/001__…/_summary.json`.

This distribution is also streamed to the frontend as the final SSE event
(`aggregate`) and rendered as a bar chart.

---

## Step 6 — Evaluate accuracy (evals/)

The eval framework compares the simulation output to the real ATP data.

### Per-agent check

For Agent 1 (`stance = "Not too much"`, prior probability = **25.1%**, rank **#2**):
- The prior said "Some" was most likely (40.5%), so this agent didn't pick the modal answer.
- But "Not too much" at 25.1% is still a plausible choice — rank 2 of 4.

For Agent 6 (`stance = "Some"`, prior probability = **40.5%**, rank **#1**):
- The agent chose the modal answer. `modal_agreement = True`.

### Aggregate check

The simulated distribution (38/30/20/12%) is compared to the ATP West-region
prior (40.5/25.1/21.9/12.6%) using Total Variation Distance:

```
TVD = ½ × (|0.385−0.405| + |0.300−0.251| + |0.200−0.219| + |0.120−0.126|)
    = ½ × (0.020 + 0.049 + 0.019 + 0.006)
    = 0.047
```

TVD = 0.047 is well within the 0.15 threshold — the simulation closely
tracks the real distribution.

### Trust score

```
validity_rate        = 1.00   (all 50 stances were valid)
mean_prior_prob      = 0.310  (average ATP probability of chosen stance)
modal_agreement_rate = 0.46   (46% of agents chose the most-likely answer)
TVD vs. national     = 0.144  (from the national marginal, not just West)

trust_score = 0.15×100 + 0.40×(0.310/0.405)×100 + 0.20×46 + 0.25×(1−0.144)×100
            ≈ 76.3  [GOOD]
```

---

## Full data flow summary

```
User input
  └─ location + question + n + selected_dims
       │
       ▼
Step 1: Sample agents (ACS/PUMS marginals)
  └─ 50 agents × {age, race, income, occupation}
       │
       ▼
Step 2: ATP prior lookup (per agent, with backoff)
  └─ 50 × {answer_label: prob} distributions
       │
       ▼
Step 3: Build LLM prompts (persona + prior + question)
       │
       ▼
Step 4: LLM responds (stance + rationale per agent)
  └─ 50 × {stance, rationale}
       │
       ▼
Step 5: Aggregate stances → distribution
  └─ {answer_label: fraction} written to _summary.json
       │
       ▼
Step 6: Eval (evals/)
  └─ per-agent prior_prob, prior_rank, modal_agreement
     aggregate TVD vs. ATP national prior
     trust_score [0–100]
```

---

## Where each piece lives on disk

```
data/
  locations/
    region_west/           ← ACS marginal CSVs (Step 1)
  atp_priors/
    policy_priors.parquet  ← ATP prior lookup table (Step 2)
  simulations/
    001__region_west__environment_climate__20260514_013000/
      _meta.json           ← request parameters
      agent_0000.json      ← demographics + prior + stance + rationale (Steps 2–4)
      agent_0001.json
      …
      _summary.json        ← aggregate distribution (Step 5)

evals/
  evaluator.py             ← reads agent_*.json + parquet, computes metrics (Step 6)
  metrics.py               ← TVD, KL, prior_prob, etc.
  run_eval.py              ← CLI to run Step 6 on any simulation
```

---

## Key numbers from this simulation

| Metric | Value |
|---|---|
| Agents sampled | 50 |
| Backoff depth (all agents) | 2 dims dropped (income + race → West only) |
| Most common stance | "Some" — 38% |
| ATP prior for "Some" (West) | 40.5% |
| TVD vs. national prior | 0.144 |
| Trust score | 76.3 / 100 (GOOD) |
