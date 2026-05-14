# CivicSim Evaluation Table

Generated 21 comparisons in 0s.

**Metrics key:** TVD = Total Variation Distance · KL = KL divergence · Hell = Hellinger · Wass = Wasserstein (ordinal only, else —)

Lower is better for all metrics.


## Economy


### MINWAGE_W87 — Should the federal minimum wage be raised to $15/hour?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=above_100000, age_group=30-49, race_eth=White | ATP (S3) (ground truth) | Strongly oppose: 29%; Somewhat favor: 27% | — | — | — | — |
| | CivicSim | Strongly favor: 50%; Somewhat favor: 27% | 0.281 | 0.316 | 0.303 | 0.272 |
| | Naive Haiku | Somewhat favor: 53%; Somewhat oppose: 37% | 0.407 | 0.468 | 0.432 | 0.320 |
| | Naive gpt-4o-mini | Strongly favor: 60%; Somewhat favor: 37% | 0.479 | 0.655 | 0.487 | 0.383 |
| income_group=above_100000, age_group=50-64, race_eth=White | ATP (S3) (ground truth) | Strongly oppose: 32%; Strongly favor: 28% | — | — | — | — |
| | CivicSim | Strongly favor: 37%; Somewhat favor: 23% | 0.121 | 0.040 | 0.102 | 0.106 |
| | Naive Haiku | Somewhat favor: 50%; Somewhat oppose: 50% | 0.604 | 0.926 | 0.609 | 0.398 |
| | Naive gpt-4o-mini | Strongly favor: 60%; Somewhat favor: 33% | 0.447 | 0.545 | 0.463 | 0.361 |
| income_group=above_100000, age_group=65+, race_eth=White | ATP (S3) (ground truth) | Strongly favor: 41%; Strongly oppose: 25% | — | — | — | — |
| | CivicSim | Strongly favor: 47%; Somewhat oppose: 23% | 0.174 | 0.108 | 0.168 | 0.127 |
| | Naive Haiku | Somewhat favor: 50%; Somewhat oppose: 50% | 0.659 | 1.129 | 0.651 | 0.484 |
| | Naive gpt-4o-mini | Strongly favor: 57%; Somewhat favor: 40% | 0.332 | 0.373 | 0.395 | 0.246 |

### INFRASTRUC21A_W95 — Do you support the bipartisan infrastructure investment bill?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=above_100000, age_group=50-64, race_eth=White | ATP (S3) (ground truth) | Favor: 52%; Oppose: 30% | — | — | — | — |
| | CivicSim | Favor: 57%; Oppose: 27% | 0.047 | 0.004 | 0.033 | 0.023 |
| | Naive Haiku | Favor: 100%; Not sure: 0% | 0.480 | 0.654 | 0.528 | 0.240 |
| | Naive gpt-4o-mini | Favor: 100%; Not sure: 0% | 0.480 | 0.654 | 0.528 | 0.240 |
| income_group=above_100000, age_group=30-49, race_eth=White | ATP (S3) (ground truth) | Favor: 57%; Oppose: 22% | — | — | — | — |
| | CivicSim | Favor: 60%; Not sure: 27% | 0.089 | 0.029 | 0.087 | 0.073 |
| | Naive Haiku | Favor: 100%; Not sure: 0% | 0.431 | 0.564 | 0.496 | 0.216 |
| | Naive gpt-4o-mini | Favor: 100%; Not sure: 0% | 0.431 | 0.564 | 0.496 | 0.216 |
| income_group=below_30000, age_group=18-29, race_eth=White | ATP (S3) (ground truth) | Favor: 53%; Not sure: 41% | — | — | — | — |
| | CivicSim | Favor: 43%; Not sure: 30% | 0.208 | 0.221 | 0.210 | 0.159 |
| | Naive Haiku | Favor: 100%; Not sure: 0% | 0.468 | 0.632 | 0.520 | 0.234 |
| | Naive gpt-4o-mini | Favor: 100%; Not sure: 0% | 0.468 | 0.632 | 0.520 | 0.234 |

## Environment & Climate


### CLIM9_W89 — How much is climate change currently affecting your local community?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White, income_group=above_100000 | ATP (S3) (ground truth) | Some: 38%; Not too much: 29% | — | — | — | — |
| | CivicSim | Some: 50%; Not too much: 37% | 0.189 | 0.101 | 0.168 | 0.085 |
| | Naive Haiku | Some: 100%; A great deal: 0% | 0.617 | 0.960 | 0.617 | 0.274 |
| | Naive gpt-4o-mini | Some: 77%; A great deal: 23% | 0.499 | 0.690 | 0.540 | 0.272 |
| race_eth=White, income_group=below_30000 | ATP (S3) (ground truth) | Some: 39%; Not too much: 32% | — | — | — | — |
| | CivicSim | Not too much: 33%; Some: 30% | 0.091 | 0.022 | 0.074 | 0.047 |
| | Naive Haiku | Some: 100%; A great deal: 0% | 0.609 | 0.939 | 0.612 | 0.253 |
| | Naive gpt-4o-mini | Some: 73%; A great deal: 27% | 0.467 | 0.628 | 0.519 | 0.247 |
| race_eth=Other, income_group=below_30000 | ATP (S3) (ground truth) | Some: 44%; A great deal: 26% | — | — | — | — |
| | CivicSim | Some: 33%; Not too much: 30% | 0.206 | 0.141 | 0.177 | 0.147 |
| | Naive Haiku | Some: 100%; A great deal: 0% | 0.558 | 0.816 | 0.579 | 0.207 |
| | Naive gpt-4o-mini | Some: 70%; A great deal: 30% | 0.294 | 0.360 | 0.403 | 0.130 |

## Family & Society


### ABORTLGL_W87 — Should abortion be legal?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=below_30000, age_group=50-64 | ATP (S3) (ground truth) | Illegal in all cases: 29%; Legal in most cases: 29% | — | — | — | — |
| | CivicSim | Legal in most cases: 53%; Illegal in most cases: 20% | 0.247 | 0.210 | 0.241 | 0.237 |
| | Naive Haiku | Legal in most cases: 100%; Illegal in all cases: 0% | 0.714 | 1.252 | 0.682 | 0.453 |
| | Naive gpt-4o-mini | Legal in most cases: 73%; Legal in all cases: 23% | 0.475 | 0.657 | 0.487 | 0.404 |
| income_group=above_100000, age_group=30-49 | ATP (S3) (ground truth) | Legal in most cases: 45%; Legal in all cases: 27% | — | — | — | — |
| | CivicSim | Legal in most cases: 40%; Legal in all cases: 33% | 0.062 | 0.010 | 0.049 | 0.022 |
| | Naive Haiku | Legal in most cases: 100%; Illegal in all cases: 0% | 0.548 | 0.795 | 0.573 | 0.411 |
| | Naive gpt-4o-mini | Legal in most cases: 80%; Legal in all cases: 20% | 0.348 | 0.397 | 0.408 | 0.278 |
| income_group=below_30000, age_group=30-49 | ATP (S3) (ground truth) | Legal in most cases: 35%; Illegal in most cases: 25% | — | — | — | — |
| | CivicSim | Legal in most cases: 37%; Legal in all cases: 30% | 0.080 | 0.017 | 0.065 | 0.041 |
| | Naive Haiku | Legal in most cases: 100%; Illegal in all cases: 0% | 0.648 | 1.044 | 0.638 | 0.462 |
| | Naive gpt-4o-mini | Legal in most cases: 63%; Legal in all cases: 27% | 0.313 | 0.314 | 0.345 | 0.252 |

## Immigration


### AFG21_2_W95 — Should the U.S. admit thousands of refugees from Afghanistan?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| age_group=50-64, race_eth=White, income_group=above_100000 | ATP (S3) (ground truth) | Somewhat favor: 35%; Somewhat oppose: 26% | — | — | — | — |
| | CivicSim | Strongly oppose: 30%; Somewhat oppose: 27% | 0.148 | 0.079 | 0.140 | 0.140 |
| | Naive Haiku | Somewhat favor: 100%; Somewhat oppose: 0% | 0.652 | 1.057 | 0.641 | 0.424 |
| | Naive gpt-4o-mini | Strongly favor: 90%; Somewhat favor: 10% | 0.674 | 1.120 | 0.602 | 0.423 |
| age_group=30-49, race_eth=White, income_group=above_100000 | ATP (S3) (ground truth) | Somewhat favor: 37%; Strongly favor: 33% | — | — | — | — |
| | CivicSim | Somewhat favor: 30%; Strongly oppose: 30% | 0.176 | 0.108 | 0.155 | 0.108 |
| | Naive Haiku | Somewhat favor: 100%; Somewhat oppose: 0% | 0.631 | 0.998 | 0.627 | 0.474 |
| | Naive gpt-4o-mini | Strongly favor: 87%; Somewhat favor: 13% | 0.533 | 0.691 | 0.490 | 0.318 |
| age_group=18-29, race_eth=White, income_group=below_30000 | ATP (S3) (ground truth) | Strongly favor: 40%; Somewhat favor: 26% | — | — | — | — |
| | CivicSim | Somewhat favor: 37%; Somewhat oppose: 27% | 0.209 | 0.093 | 0.153 | 0.119 |
| | Naive Haiku | Somewhat favor: 100%; Somewhat oppose: 0% | 0.741 | 1.351 | 0.701 | 0.573 |
| | Naive gpt-4o-mini | Strongly favor: 90%; Somewhat favor: 10% | 0.497 | 0.628 | 0.487 | 0.336 |

## Politics & Government


### GUNPRIORITY1_c_W87 — Should assault-style weapons be banned?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White, age_group=30-49, income_group=above_100000 | ATP (S3) (ground truth) | Strongly favor: 45%; Strongly oppose: 27% | — | — | — | — |
| | CivicSim | Strongly favor: 47%; Strongly oppose: 23% | 0.052 | 0.007 | 0.043 | 0.017 |
| | Naive Haiku | Somewhat favor: 75%; Strongly favor: 25% | 0.603 | 1.079 | 0.578 | 0.427 |
| | Naive gpt-4o-mini | Strongly favor: 100%; Somewhat favor: 0% | 0.554 | 0.806 | 0.576 | 0.373 |
| race_eth=White, age_group=50-64, income_group=below_30000 | ATP (S3) (ground truth) | Strongly favor: 45%; Strongly oppose: 24% | — | — | — | — |
| | CivicSim | Strongly favor: 43%; Somewhat oppose: 23% | 0.087 | 0.024 | 0.078 | 0.029 |
| | Naive Haiku | Somewhat favor: 100%; Somewhat oppose: 0% | 0.869 | 2.036 | 0.799 | 0.667 |
| | Naive gpt-4o-mini | Strongly favor: 93%; Somewhat favor: 3% | 0.488 | 0.587 | 0.459 | 0.356 |
| race_eth=White, age_group=50-64, income_group=above_100000 | ATP (S3) (ground truth) | Strongly favor: 46%; Strongly oppose: 23% | — | — | — | — |
| | CivicSim | Strongly favor: 53%; Strongly oppose: 20% | 0.138 | 0.059 | 0.124 | 0.072 |
| | Naive Haiku | Somewhat favor: 50%; Strongly favor: 50% | 0.438 | 0.843 | 0.544 | 0.357 |
| | Naive gpt-4o-mini | Strongly favor: 97%; Somewhat favor: 3% | 0.505 | 0.679 | 0.524 | 0.392 |

### POL1JB_W92 — Do you approve of the job President Biden is doing?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White, age_group=30-49, income_group=above_100000 | ATP (S3) (ground truth) | Approve: 57%; Disapprove: 43% | — | — | — | — |
| | CivicSim | Approve: 80%; Disapprove: 20% | 0.235 | 0.122 | 0.181 | 0.235 |
| | Naive Haiku | Disapprove: 100%; Approve: 0% | 0.565 | 0.833 | 0.584 | 0.565 |
| | Naive gpt-4o-mini | Disapprove: 93%; Approve: 7% | 0.499 | 0.571 | 0.411 | 0.499 |
| race_eth=White, age_group=50-64, income_group=above_100000 | ATP (S3) (ground truth) | Disapprove: 55%; Approve: 45% | — | — | — | — |
| | CivicSim | Approve: 50%; Disapprove: 50% | 0.052 | 0.005 | 0.036 | 0.052 |
| | Naive Haiku | Disapprove: 100%; Approve: 0% | 0.448 | 0.595 | 0.507 | 0.448 |
| | Naive gpt-4o-mini | Disapprove: 87%; Approve: 13% | 0.315 | 0.230 | 0.253 | 0.315 |
| race_eth=White, age_group=65+, income_group=30000_to_40000 | ATP (S3) (ground truth) | Approve: 50%; Disapprove: 50% | — | — | — | — |
| | CivicSim | Approve: 63%; Disapprove: 37% | 0.129 | 0.034 | 0.092 | 0.129 |
| | Naive Haiku | Disapprove: 100%; Approve: 0% | 0.504 | 0.702 | 0.544 | 0.504 |
| | Naive gpt-4o-mini | Disapprove: 93%; Approve: 7% | 0.438 | 0.456 | 0.370 | 0.438 |

## Summary: CivicSim vs. Naive LLMs (mean TVD vs. ATP)

| Domain | Q | Slice | CivicSim TVD | Naive Anthropic TVD | Naive OpenAI TVD | Winner |
|---|---|---|---|---|---|---|
| economy | MINWAGE_W87 | income_group=above_100000, age_group=30-49, race_eth=White | 0.281 | 0.407 | 0.479 | **CivicSim** |
| economy | MINWAGE_W87 | income_group=above_100000, age_group=50-64, race_eth=White | 0.121 | 0.604 | 0.447 | **CivicSim** |
| economy | MINWAGE_W87 | income_group=above_100000, age_group=65+, race_eth=White | 0.174 | 0.659 | 0.332 | **CivicSim** |
| economy | INFRASTRUC21A_W95 | income_group=above_100000, age_group=50-64, race_eth=White | 0.047 | 0.480 | 0.480 | **CivicSim** |
| economy | INFRASTRUC21A_W95 | income_group=above_100000, age_group=30-49, race_eth=White | 0.089 | 0.431 | 0.431 | **CivicSim** |
| economy | INFRASTRUC21A_W95 | income_group=below_30000, age_group=18-29, race_eth=White | 0.208 | 0.468 | 0.468 | **CivicSim** |
| environment_climate | CLIM9_W89 | race_eth=White, income_group=above_100000 | 0.189 | 0.617 | 0.499 | **CivicSim** |
| environment_climate | CLIM9_W89 | race_eth=White, income_group=below_30000 | 0.091 | 0.609 | 0.467 | **CivicSim** |
| environment_climate | CLIM9_W89 | race_eth=Other, income_group=below_30000 | 0.206 | 0.558 | 0.294 | **CivicSim** |
| family_society | ABORTLGL_W87 | income_group=below_30000, age_group=50-64 | 0.247 | 0.714 | 0.475 | **CivicSim** |
| family_society | ABORTLGL_W87 | income_group=above_100000, age_group=30-49 | 0.062 | 0.548 | 0.348 | **CivicSim** |
| family_society | ABORTLGL_W87 | income_group=below_30000, age_group=30-49 | 0.080 | 0.648 | 0.313 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=50-64, race_eth=White, income_group=above_100000 | 0.148 | 0.652 | 0.674 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=30-49, race_eth=White, income_group=above_100000 | 0.176 | 0.631 | 0.533 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=18-29, race_eth=White, income_group=below_30000 | 0.209 | 0.741 | 0.497 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=White, age_group=30-49, income_group=above_100000 | 0.052 | 0.603 | 0.554 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=White, age_group=50-64, income_group=below_30000 | 0.087 | 0.869 | 0.488 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=White, age_group=50-64, income_group=above_100000 | 0.138 | 0.438 | 0.505 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=White, age_group=30-49, income_group=above_100000 | 0.235 | 0.565 | 0.499 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=White, age_group=50-64, income_group=above_100000 | 0.052 | 0.448 | 0.315 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=White, age_group=65+, income_group=30000_to_40000 | 0.129 | 0.504 | 0.438 | **CivicSim** |