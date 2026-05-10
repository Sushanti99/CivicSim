import pandas as pd
from civicsim_agents import (
    check_representativeness,
    list_locations,
    sample_agents,
)


def test_list_locations_includes_alameda():
    assert "alameda_california" in list_locations()


def test_sample_agents_shape_and_columns():
    df = sample_agents("alameda_california", n_agents=10, seed=0)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 10
    assert list(df.columns) == ["agent_id", "age", "race", "income", "occupation"]
    assert df["agent_id"].tolist() == list(range(1, 11))


def test_sample_agents_seed_is_deterministic():
    a = sample_agents("alameda_california", n_agents=25, seed=42)
    b = sample_agents("alameda_california", n_agents=25, seed=42)
    pd.testing.assert_frame_equal(a, b)


def test_sample_agents_diverse_matches_marginals():
    df = sample_agents("alameda_california", n_agents=100, seed=1, diverse=True)
    rep = check_representativeness("alameda_california", df)
    for var in ("age", "race", "occupation", "income"):
        diff = (rep[var]["pop_pct"] - rep[var]["sample_pct"]).abs().max()
        # Largest-remainder rounding: max abs diff per category bounded by 1/n*100 = 1.
        assert diff <= 1.0, f"{var} drifted: {diff}"


def test_sample_agents_random_mode():
    df = sample_agents("alameda_california", n_agents=20, seed=7, diverse=False)
    assert len(df) == 20


def test_unknown_location_raises():
    try:
        sample_agents("atlantis", n_agents=5)
    except FileNotFoundError:
        return
    raise AssertionError("expected FileNotFoundError")
