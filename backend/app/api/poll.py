"""POST /api/poll — ATP-derived opinion distribution lookup."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.poll import PollRequest, PollResponse, QuestionsResponse
from app.services.opinion_prior import list_questions, lookup_distribution

router = APIRouter()


@router.get("/questions", response_model=QuestionsResponse)
def get_questions() -> QuestionsResponse:
    return QuestionsResponse(questions=list_questions())


@router.post("/poll", response_model=PollResponse)
def post_poll(req: PollRequest) -> PollResponse:
    dist, used_filter, backoff_steps = lookup_distribution(
        question_id=req.question_id,
        demographic_filter=req.demographic_filter.model_dump() if req.demographic_filter else None,
    )
    return PollResponse(
        question_id=req.question_id,
        distribution=dist,
        used_filter=used_filter,
        backoff_steps=backoff_steps,
    )
