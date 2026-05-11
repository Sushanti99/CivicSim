"""End-to-end /api/simulate orchestrator (streaming + batch)."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from datetime import datetime, timezone

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
from app.services.domain_catalog import get_domain
from app.services.llm_client import LLMClient, build_llm_client
from app.services.location_catalog import geo_for
from app.services.opinion_prior import (
    list_questions,
    lookup_distribution,
    map_agent_to_filter,
    match_free_text,
    question_label,
)
from app.services.simulation_store import SimulationStore, make_sim_id

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

    # Resolve domain metadata (optional — won't fail if domain unknown)
    domain_meta = get_domain(req.domain) if req.domain else None

    # Build the simulation ID and create the on-disk folder
    sim_id = make_sim_id(req.location, req.domain)
    meta_payload = {
        "sim_id": sim_id,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "location": req.location,
        "domain": req.domain,
        "domain_label": domain_meta["label"] if domain_meta else None,
        "question_id": qid,
        "question_label": qlabel,
        "n": req.n,
        "selected_dims": req.selected_dims,
        "model": req.model,
        "matched_from_free_text": matched,
    }
    store = SimulationStore.create(sim_id, meta_payload)

    yield SimulateEvent(
        event="meta",
        data={
            "sim_id": sim_id,
            "question_id": qid,
            "question_label": qlabel,
            "matched_from_free_text": matched,
            "answer_options": answer_options,
            "domain": req.domain,
            "domain_label": domain_meta["label"] if domain_meta else None,
        },
    )

    agents: list[AgentOut] = generate_agents(
        location=req.location, n=req.n, seed=req.seed, diverse=True
    )
    for a in agents:
        yield SimulateEvent(event="agent_sampled", data=a.model_dump())

    geo = geo_for(req.location)

    priors_per_agent: list[list[AnswerProb]] = []
    prior_details: list[dict] = []
    for a in agents:
        cell = map_agent_to_filter(
            a.model_dump(), geo=geo, selected_dims=req.selected_dims
        )
        try:
            dist, used, dropped = lookup_distribution(question_id=qid, demographic_filter=cell)
        except QuestionNotFoundError:
            dist, used, dropped = [], cell, ["question_missing"]
        priors_per_agent.append(dist)
        prior_details.append({"used_filter": used, "backoff_steps": dropped})
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
    for idx, (a, prior, pd) in enumerate(
        zip(agents, priors_per_agent, prior_details, strict=False)
    ):
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

        # Persist this agent to disk
        agent_file_data = {
            "agent_id": a.agent_id,
            "demographics": a.model_dump(),
            "selected_dims": req.selected_dims,
            "used_filter": pd["used_filter"],
            "backoff_steps": pd["backoff_steps"],
            "prior": [p.model_dump() for p in prior],
            "stance": reply.stance,
            "rationale": reply.rationale,
        }
        store.write_agent(idx, agent_file_data)

        yield SimulateEvent(event="agent_responded", data=ar.model_dump())

    aggregate = aggregate_stances([r.stance for r in responses], answer_options)

    # Persist summary
    summary_data = {
        "sim_id": sim_id,
        "question_id": qid,
        "question_label": qlabel,
        "n": len(responses),
        "distribution": [a.model_dump() for a in aggregate],
    }
    store.write_summary(summary_data)

    yield SimulateEvent(
        event="aggregate",
        data={"distribution": [a.model_dump() for a in aggregate], "n": len(responses)},
    )
    yield SimulateEvent(event="done", data={"sim_id": sim_id})


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
