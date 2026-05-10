# civicsim-agents

Probabilistic demographic agent generator. Given a U.S. location and N, draws N synthetic agents whose marginal distributions over (age, race, occupation, income) match the bundled census-style distributions for that location.

## Install

```bash
pip install -e .
```

## Library

```python
from civicsim_agents import sample_agents, list_locations

print(list_locations())
df = sample_agents("alameda_california", n=25, seed=42)
print(df.head())
```

## CLI

```bash
civicsim-agents --location alameda_california --n_agents 25 --seed 42 --validate
```

## Bundled locations

- `alameda_california` — Alameda County, California (default).

To add more locations, drop four CSVs into `civicsim_agents/data/<location_id>/`:

| File | Columns |
|---|---|
| `age.csv` | `category,count` |
| `race.csv` | `category,value` |
| `occupation.csv` | `category,totalestimate` |
| `income.csv` | `category,estimated` |
