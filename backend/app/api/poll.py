"""POST /api/poll — ATP-derived opinion distribution lookup."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.poll import PollRequest, PollResponse, QuestionsResponse
from app.services.opinion_prior import list_questions, lookup_distribution, question_label
from app.services.semantic_match import _client_available, match_level, semantic_match
from app.core.errors import QuestionNotFoundError

router = APIRouter()

# Policy-signal words — any one present makes a question policy-adjacent.
_POLICY_SIGNALS = {
    "should", "government", "policy", "law", "regulation", "federal", "state",
    "congress", "tax", "taxes", "spending", "immigration", "healthcare", "climate",
    "education", "gun", "guns", "abortion", "welfare", "military", "budget",
    "vote", "voting", "election", "rights", "reform", "ban", "legal", "illegal",
    "fund", "funding", "increase", "support", "oppose", "allow", "restrict",
    "require", "mandate", "public", "national", "local", "court",
    "amendment", "constitution", "police", "border", "trade", "tariff",
    "wage", "housing", "infrastructure", "energy", "drug", "drugs",
    "criminal", "crime", "prison", "sentence", "penalty",
}

# Words that mark the start of a question.
_QUESTION_STARTERS = {
    "should", "would", "do", "does", "is", "are", "can", "will",
    "how", "what", "why", "which", "when", "where",
}


@router.get("/questions", response_model=QuestionsResponse)
def get_questions() -> QuestionsResponse:
    return QuestionsResponse(questions=list_questions())


@router.post("/poll", response_model=PollResponse)
def post_poll(req: PollRequest) -> PollResponse:
    # Drop unset fields so they don't override the cell's MARGINAL default.
    filt = (
        {k: v for k, v in req.demographic_filter.model_dump().items() if v}
        if req.demographic_filter
        else None
    )
    dist, used_filter, backoff_steps = lookup_distribution(
        question_id=req.question_id,
        demographic_filter=filt,
    )
    return PollResponse(
        question_id=req.question_id,
        distribution=dist,
        used_filter=used_filter,
        backoff_steps=backoff_steps,
    )


@router.get("/match-question")
def get_match_question(q: str = Query(..., description="Free-text policy question to match.")):
    """Return the closest ATP question and a match level (close/weak/none)."""
    questions = [(qu.question_id, qu.question_label) for qu in list_questions()]
    using_embed = _client_available()
    qid, score = semantic_match(q, questions)
    level = match_level(score, using_embeddings=using_embed)
    if level == "none":
        qid = None

    label: str | None = None
    if qid:
        try:
            label = question_label(qid)
        except QuestionNotFoundError:
            qid = None
            level = "none"

    return {"question_id": qid, "question_label": label, "score": round(score, 4), "match_level": level}


@router.get("/validate-question")
def get_validate_question(q: str = Query(..., description="Free-text question to validate.")):
    """Check whether a free-text string looks like a policy question."""
    text = q.strip()
    if len(text) < 8:
        return {"is_policy": False, "reason": "Too short to be a policy question."}

    words = {w.lower().rstrip("?,!.") for w in text.split()}
    first_word = text.split()[0].lower() if text.split() else ""

    has_question_form = first_word in _QUESTION_STARTERS or text.rstrip().endswith("?")
    has_policy_signal = bool(words & _POLICY_SIGNALS)

    if not has_question_form:
        return {
            "is_policy": False,
            "reason": 'Frame this as a question — start with "Should", "Would", "Do", etc., or end with a ?.',
        }
    if not has_policy_signal:
        return {
            "is_policy": False,
            "reason": "This does not look like a policy question. Ask about government, law, elections, or civic issues.",
        }
    return {"is_policy": True, "reason": ""}
