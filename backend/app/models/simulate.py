from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.models.agents import AgentOut
from app.models.poll import AnswerProb


class SimulateRequest(BaseModel):
    location: str = Field(..., description="Location ID.")
    n: int = Field(25, ge=1, le=100)
    question_id: str | None = Field(None, description="Curated ATP question ID.")
    free_text: str | None = Field(
        None,
        description="Free-text policy question. If set without question_id, "
        "the backend matches it to the nearest known question.",
    )
    seed: int | None = None
    model: str | None = Field(
        None,
        description="Override the default LLM model for this request.",
    )

    @model_validator(mode="after")
    def _need_question(self) -> SimulateRequest:
        if not self.question_id and not (self.free_text and self.free_text.strip()):
            raise ValueError("Provide either question_id or free_text.")
        return self


class AgentResponse(BaseModel):
    agent_id: int
    stance: str
    rationale: str
    prior: list[AnswerProb]


class SimulateResponse(BaseModel):
    question_id: str
    question_label: str
    matched_from_free_text: bool = False
    n: int
    agents: list[AgentOut]
    responses: list[AgentResponse]
    aggregate: list[AnswerProb]


class SimulateEvent(BaseModel):
    event: str
    data: dict[str, Any]
