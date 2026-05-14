# CivicSim Evaluation Table

Generated 2 comparisons in 56s.

**Metrics key:** TVD = Total Variation Distance · KL = KL divergence · Hell = Hellinger · Wass = Wasserstein (ordinal only, else —)

Lower is better for all metrics.


## Economy


### MINWAGE_W87 — Should the federal minimum wage be raised to $15/hour?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=below_30000, age_group=65+, race_eth=White | ATP (parquet) (ground truth) | Strongly favor: 34%; Somewhat oppose: 33%; Strongly oppose: 22%; Somewhat favor: 10% | — | — | — | — |
| | CivicSim | Strongly favor: 47%; Somewhat favor: 23%; Strongly oppose: 20%; Somewhat oppose: 10% | 0.257 | 0.196 | 0.229 | 0.204 |
| | Naive Haiku | — | — | — | — | — |
| | Naive gpt-4o-mini | — | — | — | — | — |

## Politics & Government


### POL1JB_W92 — Do you approve of the job President Biden is doing?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White, age_group=18-29, income_group=50000_to_60000 | ATP (parquet) (ground truth) | Disapprove: 60%; Approve: 40% | — | — | — | — |
| | CivicSim | Approve: 63%; Disapprove: 37% | 0.234 | 0.111 | 0.167 | 0.234 |
| | Naive Haiku | — | — | — | — | — |
| | Naive gpt-4o-mini | — | — | — | — | — |

## Summary: CivicSim vs. Naive LLMs (mean TVD vs. ATP)

| Domain | Q | Slice | CivicSim TVD | Naive Anthropic TVD | Naive OpenAI TVD | Winner |
|---|---|---|---|---|---|---|
| economy | MINWAGE_W87 | income_group=below_30000, age_group=65+, race_eth=White | 0.257 | — | — | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=White, age_group=18-29, income_group=50000_to_60000 | 0.234 | — | — | **CivicSim** |