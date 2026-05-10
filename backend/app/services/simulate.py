"""End-to-end /api/simulate orchestrator (streaming + batch)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from app.core.errors import QuestionNotFoundError
from app.models.agents import AgentOut
from app.models.poll import AnswerProb
from app.models.simulate import (
    AgentResponse,
    SimulateEvent,
    SimulateRequest,
    SimulateResponse,
)
from app.services.agent_generator import generate_agents
from app.services.aggregator import aggregate_stances
from app.services.llm_client import LLMClient, build_llm_client
from app.services.opinion_prior import (
    list_questions,
    lookup_distribution,
    map_agent_to_filter,
    match_free_text,
    question_label,
)

logger = logging.getLogger(__name__)


def _resolve_question(req: SimulateRequest) -> tuple[str, str, bool]:
    """Return (question_id, question_label, matched_from_free_text)."""
    if req.question_id:
        return req.question_id, question_label(req.question_id), False
    matched = match_free_text(req.free_text or "")
    if not matched:
        raise QuestionNotFoundError(
            "Could not match free_text to any known ATP question. Pass a question_id."
        )
    return matched, question_label(matched), True


def _answer_options_for(question_id: str) -> list[str]:
    for q in list_questions():
        if q.question_id == question_id:
            return q.answer_labels
    raise QuestionNotFoundError(f"Unknown question_id: {question_id}")


async def run_simulation_stream(
    req: SimulateRequest,
    *,
    llm: LLMClient | None = None,
) -> AsyncIterator[SimulateEvent]:
    llm = llm or build_llm_client()

    qid, qlabel, matched = _resolve_question(req)
    answer_options = _answer_options_for(qid)

    yield SimulateEvent(
        event="meta",
        data={
            "question_id": qid,
            "question_label": qlabel,
            "matched_from_free_text": matched,
            "answer_options": answer_options,
        },
    )

    agents: list[AgentOut] = generate_agents(
        location=req.location, n=req.n, seed=req.seed, diverse=True
    )
    for a in agents:
        yield SimulateEvent(event="agent_sampled", data=a.model_dump())

    priors_per_agent: list[list[AnswerProb]] = []
    for a in agents:
        cell = map_agent_to_filter(a.model_dump())
        try:
            dist, used, dropped = lookup_distribution(question_id=qid, demographic_filter=cell)
        except QuestionNotFoundError:
            dist, used, dropped = [], cell, ["question_missing"]
        priors_per_agent.append(dist)
        yield SimulateEvent(
            event="prior_attached",
            data={
                "agent_id": a.agent_id,
                "prior": [p.model_dump() for p in dist],
                "used_filter": used,
                "backoff_steps": dropped,
            },
        )

    responses: list[AgentResponse] = []
    for a, prior in zip(agents, priors_per_agent, strict=False):
        reply = await llm.respond_as_agent(
            persona=a.model_dump(),
            question=qlabel,
            answer_options=answer_options,
            prior=prior,
            model=req.model,
        )
        ar = AgentResponse(
            agent_id=a.agent_id,
            stance=reply.stance,
            rationale=reply.rationale,
            prior=prior,
        )
        responses.append(ar)
        yield SimulateEvent(event="agent_responded", data=ar.model_dump())

    aggregate = aggregate_stances([r.stance for r in responses], answer_options)
    yield SimulateEvent(
        event="aggregate",
        data={"distribution": [a.model_dump() for a in aggregate], "n": len(responses)},
    )
    yield SimulateEvent(event="done", data={})


async def collect_simulation(req: SimulateRequest, *, llm: LLMClient | None = None) -> SimulateResponse:
    """Run the stream to completion and assemble a single JSON response."""
    qid: str | None = None
    qlabel: str = ""
    matched = False
    agents_seen: list[AgentOut] = []
    priors_by_agent: dict[int, list[AnswerProb]] = {}
    responses: list[AgentResponse] = []
    aggregate: list[AnswerProb] = []

    async for ev in run_simulation_stream(req, llm=llm):
        if ev.event == "meta":
            qid = ev.data["question_id"]
            qlabel = ev.data["question_label"]
            matched = ev.data["matched_from_free_text"]
        elif ev.event == "agent_sampled":
            agents_seen.append(AgentOut(**ev.data))
        elif ev.event == "prior_attached":
            priors_by_agent[ev.data["agent_id"]] = [AnswerProb(**p) for p in ev.data["prior"]]
        elif ev.event == "agent_responded":
            responses.append(AgentResponse(**ev.data))
        elif ev.event == "aggregate":
            aggregate = [AnswerProb(**p) for p in ev.data["distribution"]]

    return SimulateResponse(
        question_id=qid or "",
        question_label=qlabel,
        matched_from_free_text=matched,
        n=len(agents_seen),
        agents=agents_seen,
        responses=responses,
        aggregate=aggregate,
    )
