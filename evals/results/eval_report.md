# CivicSim Evaluation Table

Generated 21 comparisons in 600s.

**Metrics key:** TVD = Total Variation Distance · KL = KL divergence · Hell = Hellinger · Wass = Wasserstein (ordinal only, else —)

Lower is better for all metrics.


## Economy


### MINWAGE_W87 — Should the federal minimum wage be raised to $15/hour?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=below_30000, age_group=50-64, race_eth=White | ATP (S3) (ground truth) | Strongly favor: 28%; Somewhat oppose: 27%; Somewhat favor: 26%; Strongly oppose: 19% | — | — | — | — |
| | CivicSim | Strongly favor: 57%; Somewhat favor: 17%; Somewhat oppose: 13%; Strongly oppose: 13% | 0.286 | 0.183 | 0.211 | 0.177 |
| | Naive Haiku | Somewhat favor: 47%; Somewhat oppose: 37%; Strongly favor: 17% | 0.303 | 0.296 | 0.347 | 0.232 |
| | Naive gpt-4o-mini | Strongly favor: 57%; Somewhat favor: 37%; Somewhat oppose: 7% | 0.389 | 0.427 | 0.396 | 0.288 |
| income_group=above_100000, age_group=30-49, race_eth=White | ATP (S3) (ground truth) | Strongly oppose: 29%; Somewhat favor: 27%; Somewhat oppose: 22%; Strongly favor: 22% | — | — | — | — |
| | CivicSim | Strongly favor: 53%; Somewhat favor: 23%; Strongly oppose: 17%; Somewhat oppose: 7% | 0.314 | 0.270 | 0.258 | 0.251 |
| | Naive Haiku | Strongly favor: 67%; Somewhat favor: 33% | 0.513 | 0.814 | 0.565 | 0.416 |
| | Naive gpt-4o-mini | Strongly favor: 60%; Somewhat favor: 37%; Somewhat oppose: 3% | 0.479 | 0.655 | 0.487 | 0.383 |
| income_group=below_30000, age_group=30-49, race_eth=Other | ATP (S3) (ground truth) | Strongly favor: 64%; Somewhat favor: 20%; Somewhat oppose: 10%; Strongly oppose: 6% | — | — | — | — |
| | CivicSim | Strongly favor: 47%; Somewhat favor: 27%; Somewhat oppose: 17%; Strongly oppose: 10% | 0.170 | 0.064 | 0.125 | 0.107 |
| | Naive Haiku | Somewhat favor: 50%; Somewhat oppose: 50% | 0.692 | 1.234 | 0.673 | 0.381 |
| | Naive gpt-4o-mini | Strongly favor: 63%; Somewhat favor: 27%; Somewhat oppose: 10% | 0.063 | 0.065 | 0.174 | 0.040 |

### INFRASTRUC21A_W95 — Do you support the bipartisan infrastructure investment bill?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| income_group=90000_to_100000, age_group=30-49, race_eth=White | ATP (S3) (ground truth) | Not sure: 41%; Favor: 39%; Oppose: 20% | — | — | — | — |
| | CivicSim | Favor: 43%; Not sure: 33%; Oppose: 23% | 0.074 | 0.012 | 0.055 | 0.055 |
| | Naive Haiku | Favor: 100% | 0.606 | 0.932 | 0.610 | 0.303 |
| | Naive gpt-4o-mini | Favor: 100% | 0.606 | 0.932 | 0.610 | 0.303 |
| income_group=below_30000, age_group=18-29, race_eth=White | ATP (S3) (ground truth) | Favor: 53%; Not sure: 41%; Oppose: 6% | — | — | — | — |
| | CivicSim | Favor: 43%; Not sure: 37%; Oppose: 20% | 0.141 | 0.116 | 0.155 | 0.092 |
| | Naive Haiku | Favor: 100% | 0.468 | 0.632 | 0.520 | 0.234 |
| | Naive gpt-4o-mini | Favor: 100% | 0.468 | 0.632 | 0.520 | 0.234 |
| income_group=30000_to_40000, age_group=18-29, race_eth=Other | ATP (S3) (ground truth) | Favor: 78%; Oppose: 14%; Not sure: 8% | — | — | — | — |
| | CivicSim | Favor: 47%; Oppose: 30%; Not sure: 23% | 0.313 | 0.235 | 0.233 | 0.156 |
| | Naive Haiku | Favor: 100% | 0.220 | 0.249 | 0.342 | 0.110 |
| | Naive gpt-4o-mini | Favor: 100% | 0.220 | 0.249 | 0.342 | 0.110 |

## Environment & Climate


### CLIM9_W89 — How much is climate change currently affecting your local community?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White | ATP (S3) (ground truth) | Some: 38%; Not too much: 30%; Not at all: 19%; A great deal: 12% | — | — | — | — |
| | CivicSim | Not too much: 33%; Some: 30%; Not at all: 23%; A great deal: 13% | 0.080 | 0.015 | 0.061 | 0.040 |
| | Naive Haiku | Some: 100% | 0.620 | 0.968 | 0.619 | 0.271 |
| | Naive gpt-4o-mini | Some: 73%; A great deal: 27% | 0.498 | 0.690 | 0.540 | 0.278 |
| F_CREGION=South | ATP (S3) (ground truth) | Some: 40%; Not too much: 27%; A great deal: 18%; Not at all: 16% | — | — | — | — |
| | CivicSim | Not too much: 37%; Some: 30%; A great deal: 27%; Not at all: 7% | 0.190 | 0.084 | 0.148 | 0.063 |
| | Naive Haiku | Some: 100% | 0.604 | 0.926 | 0.609 | 0.255 |
| | Naive gpt-4o-mini | Some: 77%; A great deal: 23% | 0.429 | 0.573 | 0.497 | 0.216 |
| F_CREGION=West | ATP (S3) (ground truth) | Some: 40%; Not too much: 25%; A great deal: 22%; Not at all: 13% | — | — | — | — |
| | CivicSim | Some: 43%; Not too much: 33%; A great deal: 13%; Not at all: 10% | 0.111 | 0.035 | 0.096 | 0.056 |
| | Naive Haiku | Some: 100% | 0.595 | 0.905 | 0.603 | 0.240 |
| | Naive gpt-4o-mini | Some: 67%; A great deal: 33% | 0.377 | 0.473 | 0.459 | 0.206 |

## Family & Society


### ABORTLGL_W87 — Should abortion be legal?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| F_CREGION=West | ATP (S3) (ground truth) | Legal in most cases: 32%; Legal in all cases: 30%; Illegal in most cases: 23%; Illegal in all cases: 14% | — | — | — | — |
| | CivicSim | Legal in most cases: 47%; Legal in all cases: 30%; Illegal in all cases: 17%; Illegal in most cases: 7% | 0.168 | 0.113 | 0.180 | 0.150 |
| | Naive Haiku | Legal in most cases: 100% | 0.676 | 1.126 | 0.656 | 0.504 |
| | Naive gpt-4o-mini | Legal in most cases: 67%; Legal in all cases: 30%; Illegal in most cases: 3% | 0.342 | 0.415 | 0.383 | 0.275 |
| F_CREGION=Midwest | ATP (S3) (ground truth) | Legal in most cases: 33%; Illegal in most cases: 28%; Legal in all cases: 24%; Illegal in all cases: 15% | — | — | — | — |
| | CivicSim | Legal in most cases: 40%; Illegal in most cases: 30%; Illegal in all cases: 17%; Legal in all cases: 13% | 0.104 | 0.035 | 0.097 | 0.084 |
| | Naive Haiku | Legal in most cases: 100% | 0.666 | 1.096 | 0.650 | 0.474 |
| | Naive gpt-4o-mini | Legal in most cases: 77%; Legal in all cases: 20%; Illegal in most cases: 3% | 0.433 | 0.532 | 0.423 | 0.325 |
| F_CREGION=South | ATP (S3) (ground truth) | Legal in most cases: 35%; Illegal in most cases: 31%; Legal in all cases: 20%; Illegal in all cases: 14% | — | — | — | — |
| | CivicSim | Legal in most cases: 47%; Legal in all cases: 23%; Illegal in most cases: 20%; Illegal in all cases: 10% | 0.157 | 0.053 | 0.116 | 0.106 |
| | Naive Haiku | Legal in most cases: 100% | 0.652 | 1.056 | 0.641 | 0.452 |
| | Naive gpt-4o-mini | Legal in most cases: 73%; Legal in all cases: 20%; Illegal in most cases: 7% | 0.390 | 0.449 | 0.391 | 0.306 |

## Immigration


### AFG21_2_W95 — Should the U.S. admit thousands of refugees from Afghanistan?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| age_group=50-64, race_eth=Other, income_group=below_30000 | ATP (S3) (ground truth) | Somewhat oppose: 41%; Somewhat favor: 23%; Strongly oppose: 22%; Strongly favor: 15% | — | — | — | — |
| | CivicSim | Somewhat favor: 30%; Somewhat oppose: 30%; Strongly favor: 20%; Strongly oppose: 20% | 0.126 | 0.036 | 0.094 | 0.053 |
| | Naive Haiku | Somewhat favor: 100% | 0.774 | 1.486 | 0.724 | 0.454 |
| | Naive gpt-4o-mini | Strongly favor: 93%; Somewhat favor: 7% | 0.784 | 1.635 | 0.711 | 0.544 |
| age_group=30-49, race_eth=Other, income_group=below_30000 | ATP (S3) (ground truth) | Somewhat favor: 43%; Somewhat oppose: 29%; Strongly oppose: 14%; Strongly favor: 14% | — | — | — | — |
| | CivicSim | Somewhat favor: 40%; Somewhat oppose: 23%; Strongly oppose: 20%; Strongly favor: 17% | 0.091 | 0.022 | 0.073 | 0.052 |
| | Naive Haiku | Somewhat favor: 100% | 0.567 | 0.838 | 0.585 | 0.328 |
| | Naive gpt-4o-mini | Strongly favor: 100% | 0.865 | 2.002 | 0.795 | 0.526 |
| age_group=18-29, race_eth=Black or African-American, income_group=below_30000 | ATP (S3) (ground truth) | Strongly oppose: 34%; Somewhat favor: 31%; Somewhat oppose: 28%; Strongly favor: 7% | — | — | — | — |
| | CivicSim | Somewhat favor: 40%; Somewhat oppose: 33%; Strongly oppose: 20%; Strongly favor: 7% | 0.143 | 0.051 | 0.116 | 0.079 |
| | Naive Haiku | Somewhat favor: 100% | 0.691 | 1.175 | 0.667 | 0.481 |
| | Naive gpt-4o-mini | Strongly favor: 100% | 0.931 | 2.680 | 0.859 | 0.641 |

## Politics & Government


### GUNPRIORITY1_c_W87 — Should assault-style weapons be banned?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=White, age_group=65+, income_group=above_100000 | ATP (S3) (ground truth) | Strongly favor: 60%; Strongly oppose: 21%; Somewhat favor: 11%; Somewhat oppose: 8% | — | — | — | — |
| | CivicSim | Strongly favor: 60%; Somewhat favor: 13%; Somewhat oppose: 13%; Strongly oppose: 13% | 0.074 | 0.031 | 0.088 | 0.042 |
| | Naive Haiku | Somewhat favor: 50%; Strongly favor: 50% | 0.390 | 0.664 | 0.466 | 0.295 |
| | Naive gpt-4o-mini | Strongly favor: 100% | 0.400 | 0.510 | 0.475 | 0.308 |
| race_eth=Black or African-American, age_group=50-64, income_group=below_30000 | ATP (S3) (ground truth) | Strongly favor: 71%; Strongly oppose: 18%; Somewhat oppose: 6%; Somewhat favor: 5% | — | — | — | — |
| | CivicSim | Strongly favor: 63%; Strongly oppose: 20%; Somewhat favor: 10%; Somewhat oppose: 7% | 0.081 | 0.028 | 0.080 | 0.050 |
| | Naive Haiku | Somewhat favor: 100% | 0.952 | 3.039 | 0.884 | 0.674 |
| | Naive gpt-4o-mini | Strongly favor: 97%; Somewhat favor: 3% | 0.252 | 0.280 | 0.359 | 0.223 |
| race_eth=White, age_group=30-49, income_group=below_30000 | ATP (S3) (ground truth) | Strongly favor: 40%; Strongly oppose: 23%; Somewhat oppose: 20%; Somewhat favor: 16% | — | — | — | — |
| | CivicSim | Strongly favor: 53%; Somewhat favor: 20%; Strongly oppose: 17%; Somewhat oppose: 10% | 0.170 | 0.067 | 0.132 | 0.134 |
| | Naive Haiku | Somewhat favor: 50%; Strongly favor: 50% | 0.437 | 0.681 | 0.518 | 0.337 |
| | Naive gpt-4o-mini | Strongly favor: 100% | 0.595 | 0.905 | 0.603 | 0.407 |

### POL1JB_W92 — Do you approve of the job President Biden is doing?

| Slice | Condition | Top answers | TVD | KL | Hell | Wass |
|---|---|---|---|---|---|---|
| race_eth=Other, age_group=30-49, income_group=below_30000 | ATP (S3) (ground truth) | Approve: 75%; Disapprove: 25% | — | — | — | — |
| | CivicSim | Disapprove: 57%; Approve: 43% | 0.321 | 0.233 | 0.235 | 0.321 |
| | Naive Haiku | Disapprove: 100% | 0.754 | 1.403 | 0.710 | 0.754 |
| | Naive gpt-4o-mini | Disapprove: 100% | 0.754 | 1.403 | 0.710 | 0.754 |
| race_eth=White, age_group=30-49, income_group=30000_to_40000 | ATP (S3) (ground truth) | Disapprove: 55%; Approve: 45% | — | — | — | — |
| | CivicSim | Disapprove: 53%; Approve: 47% | 0.012 | 0.000 | 0.009 | 0.012 |
| | Naive Haiku | Disapprove: 100% | 0.455 | 0.606 | 0.511 | 0.455 |
| | Naive gpt-4o-mini | Disapprove: 93%; Approve: 7% | 0.388 | 0.374 | 0.335 | 0.388 |
| race_eth=Other, age_group=50-64, income_group=below_30000 | ATP (S3) (ground truth) | Approve: 71%; Disapprove: 29% | — | — | — | — |
| | CivicSim | Approve: 77%; Disapprove: 23% | 0.060 | 0.009 | 0.048 | 0.060 |
| | Naive Haiku | Disapprove: 100% | 0.707 | 1.226 | 0.677 | 0.707 |
| | Naive gpt-4o-mini | Disapprove: 87%; Approve: 13% | 0.573 | 0.716 | 0.434 | 0.573 |

## Summary: CivicSim vs. Naive LLMs (mean TVD vs. ATP)

| Domain | Q | Slice | CivicSim TVD | Naive Anthropic TVD | Naive OpenAI TVD | Winner |
|---|---|---|---|---|---|---|
| economy | MINWAGE_W87 | income_group=below_30000, age_group=50-64, race_eth=White | 0.286 | 0.303 | 0.389 | **CivicSim** |
| economy | MINWAGE_W87 | income_group=above_100000, age_group=30-49, race_eth=White | 0.314 | 0.513 | 0.479 | **CivicSim** |
| economy | MINWAGE_W87 | income_group=below_30000, age_group=30-49, race_eth=Other | 0.170 | 0.692 | 0.063 | **Naive gpt-4o-mini** |
| economy | INFRASTRUC21A_W95 | income_group=90000_to_100000, age_group=30-49, race_eth=White | 0.074 | 0.606 | 0.606 | **CivicSim** |
| economy | INFRASTRUC21A_W95 | income_group=below_30000, age_group=18-29, race_eth=White | 0.141 | 0.468 | 0.468 | **CivicSim** |
| economy | INFRASTRUC21A_W95 | income_group=30000_to_40000, age_group=18-29, race_eth=Other | 0.313 | 0.220 | 0.220 | **Naive Haiku** |
| environment_climate | CLIM9_W89 | race_eth=White | 0.080 | 0.620 | 0.498 | **CivicSim** |
| environment_climate | CLIM9_W89 | F_CREGION=South | 0.190 | 0.604 | 0.429 | **CivicSim** |
| environment_climate | CLIM9_W89 | F_CREGION=West | 0.111 | 0.595 | 0.377 | **CivicSim** |
| family_society | ABORTLGL_W87 | F_CREGION=West | 0.168 | 0.676 | 0.342 | **CivicSim** |
| family_society | ABORTLGL_W87 | F_CREGION=Midwest | 0.104 | 0.666 | 0.433 | **CivicSim** |
| family_society | ABORTLGL_W87 | F_CREGION=South | 0.157 | 0.652 | 0.390 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=50-64, race_eth=Other, income_group=below_30000 | 0.126 | 0.774 | 0.784 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=30-49, race_eth=Other, income_group=below_30000 | 0.091 | 0.567 | 0.865 | **CivicSim** |
| immigration | AFG21_2_W95 | age_group=18-29, race_eth=Black or African-American, income_group=below_30000 | 0.143 | 0.691 | 0.931 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=White, age_group=65+, income_group=above_100000 | 0.074 | 0.390 | 0.400 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=Black or African-American, age_group=50-64, income_group=below_30000 | 0.081 | 0.952 | 0.252 | **CivicSim** |
| politics_gov | GUNPRIORITY1_c_W87 | race_eth=White, age_group=30-49, income_group=below_30000 | 0.170 | 0.437 | 0.595 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=Other, age_group=30-49, income_group=below_30000 | 0.321 | 0.754 | 0.754 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=White, age_group=30-49, income_group=30000_to_40000 | 0.012 | 0.455 | 0.388 | **CivicSim** |
| politics_gov | POL1JB_W92 | race_eth=Other, age_group=50-64, income_group=below_30000 | 0.060 | 0.707 | 0.573 | **CivicSim** |