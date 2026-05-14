"""End-to-end /api/simulate orchestrator (streaming + batch)."""

from __future__ import annotations

import asyncio
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


_DEFAULT_ANSWER_OPTIONS = [
    "Strongly support",
    "Somewhat support",
    "Neither support nor oppose",
    "Somewhat oppose",
    "Strongly oppose",
]


def _answer_options_for(question_id: str) -> list[str]:
    for q in list_questions():
        if q.question_id == question_id:
            return q.answer_labels
    raise QuestionNotFoundError(f"Unknown question_id: {question_id}")


def _resolve_question(
    req: SimulateRequest,
) -> tuple[str | None, str, list[str], str | None]:
    """Return (prior_question_id, question_label, answer_options, prior_source_label).

    prior_question_id:  ATP question used for demographic prior lookup (may be None).
    question_label:     The actual question shown to agents and stored in the run.
    answer_options:     Choices agents pick from.
    prior_source_label: Human-readable label of the ATP source question, if different
                        from question_label (shown in UI for transparency).
    """
    if req.question_id:
        # Curated question — full grounding, behaviour unchanged.
        qlabel = question_label(req.question_id)
        options = _answer_options_for(req.question_id)
        return req.question_id, qlabel, options, None

    # Free-text path: the user's words ARE the question.
    user_q = (req.free_text or "").strip()

    # Best-effort: try to find an ATP question for a demographic prior.
    prior_qid, _ = match_free_text(user_q)
    if prior_qid:
        try:
            options = _answer_options_for(prior_qid)
            prior_label = question_label(prior_qid)
        except QuestionNotFoundError:
            prior_qid = None
            options = req.custom_answer_options or _DEFAULT_ANSWER_OPTIONS
            prior_label = None
    else:
        options = req.custom_answer_options or _DEFAULT_ANSWER_OPTIONS
        prior_label = None

    return prior_qid, user_q, options, prior_label


async def run_simulation_stream(
    req: SimulateRequest,
    *,
    llm: LLMClient | None = None,
) -> AsyncIterator[SimulateEvent]:
    llm = llm or build_llm_client()

    prior_qid, qlabel, answer_options, prior_source_label = _resolve_question(req)
    has_prior = prior_qid is not None

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
        "question_id": prior_qid,
        "question_label": qlabel,
        "n": req.n,
        "selected_dims": req.selected_dims,
        "model": req.model,
        "has_prior": has_prior,
        "prior_source_label": prior_source_label,
    }
    store = SimulationStore.create(sim_id, meta_payload)

    yield SimulateEvent(
        event="meta",
        data={
            "sim_id": sim_id,
            "question_id": prior_qid,
            "question_label": qlabel,
            "has_prior": has_prior,
            "prior_source_label": prior_source_label,
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
        await asyncio.sleep(0)  # yield control so the event flushes immediately

    geo = geo_for(req.location)

    priors_per_agent: list[list[AnswerProb]] = []
    prior_details: list[dict] = []
    for a in agents:
        if has_prior:
            cell = map_agent_to_filter(
                a.model_dump(), geo=geo, selected_dims=req.selected_dims
            )
            try:
                dist, used, dropped = lookup_distribution(
                    question_id=prior_qid, demographic_filter=cell  # type: ignore[arg-type]
                )
            except QuestionNotFoundError:
                dist, used, dropped = [], cell, ["question_missing"]
        else:
            dist, used, dropped = [], {}, []
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
        "question_id": prior_qid,
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
    has_prior = False
    prior_source_label: str | None = None
    agents_seen: list[AgentOut] = []
    responses: list[AgentResponse] = []
    aggregate: list[AnswerProb] = []

    async for ev in run_simulation_stream(req, llm=llm):
        if ev.event == "meta":
            qid = ev.data["question_id"]
            qlabel = ev.data["question_label"]
            has_prior = ev.data["has_prior"]
            prior_source_label = ev.data["prior_source_label"]
        elif ev.event == "agent_sampled":
            agents_seen.append(AgentOut(**ev.data))
        elif ev.event == "agent_responded":
            responses.append(AgentResponse(**ev.data))
        elif ev.event == "aggregate":
            aggregate = [AnswerProb(**p) for p in ev.data["distribution"]]

    return SimulateResponse(
        question_id=qid,
        question_label=qlabel,
        has_prior=has_prior,
        prior_source_label=prior_source_label,
        n=len(agents_seen),
        agents=agents_seen,
        responses=responses,
        aggregate=aggregate,
    )
