from __future__ import annotations

from pydantic import BaseModel, Field


class DemographicFilter(BaseModel):
    F_CREGION: str | None = None
    F_CDIVISION: str | None = None
    age_group: str | None = None
    gender: str | None = None
    race_eth: str | None = None
    education_group: str | None = None
    income_group: str | None = None
    urbanicity: str | None = None


class AnswerProb(BaseModel):
    answer_label: str
    prob: float = Field(..., ge=0.0, le=1.0)


class QuestionMeta(BaseModel):
    question_id: str
    question_label: str
    answer_labels: list[str]


class QuestionsResponse(BaseModel):
    questions: list[QuestionMeta]


class PollRequest(BaseModel):
    question_id: str
    demographic_filter: DemographicFilter | None = None


class PollResponse(BaseModel):
    question_id: str
    distribution: list[AnswerProb]
    used_filter: dict
    backoff_steps: list[str] = Field(
        default_factory=list,
        description="Demographic dims dropped to find a populated cell.",
    )
