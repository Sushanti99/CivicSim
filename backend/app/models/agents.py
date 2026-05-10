from __future__ import annotations

from pydantic import BaseModel, Field


class AgentOut(BaseModel):
    agent_id: int
    age: str
    race: str
    income: str
    occupation: str


class AgentsRequest(BaseModel):
    location: str = Field(..., description="Location ID, e.g. 'alameda_california'.")
    n: int = Field(25, ge=1, le=200, description="Number of agents to sample.")
    seed: int | None = Field(None, description="Optional RNG seed.")
    diverse: bool = Field(True, description="Stratified sampling matching marginals (default).")


class AgentsResponse(BaseModel):
    location: str
    n: int
    agents: list[AgentOut]
