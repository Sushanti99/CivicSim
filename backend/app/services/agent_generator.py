"""Wraps civicsim_agents.sample_agents for the API layer."""

from __future__ import annotations

from civicsim_agents import sample_agents

from app.core.errors import LocationNotFoundError
from app.models.agents import AgentOut


def generate_agents(*, location: str, n: int, seed: int | None, diverse: bool = True) -> list[AgentOut]:
    try:
        df = sample_agents(location, n_agents=n, seed=seed, diverse=diverse)
    except FileNotFoundError as exc:
        raise LocationNotFoundError(str(exc)) from exc

    return [
        AgentOut(
            agent_id=int(row.agent_id),
            age=str(row.age),
            race=str(row.race),
            income=str(row.income),
            occupation=str(row.occupation),
        )
        for row in df.itertuples(index=False)
    ]
