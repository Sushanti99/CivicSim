"""POST /api/agents — sample synthetic agents for a location."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.agents import AgentsRequest, AgentsResponse
from app.services.agent_generator import generate_agents

router = APIRouter()


@router.post("/agents", response_model=AgentsResponse)
def post_agents(req: AgentsRequest) -> AgentsResponse:
    agents = generate_agents(location=req.location, n=req.n, seed=req.seed, diverse=req.diverse)
    return AgentsResponse(location=req.location, n=len(agents), agents=agents)
