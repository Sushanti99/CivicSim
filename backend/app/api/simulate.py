"""POST /api/simulate — full agent + prior + LLM pipeline with SSE streaming."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.models.simulate import SimulateRequest, SimulateResponse
from app.services.simulate import collect_simulation, run_simulation_stream

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/simulate")
async def post_simulate(req: SimulateRequest, request: Request):
    """Run the simulation pipeline.

    By default returns SSE. If the client sends ``Accept: application/json``
    we collect the stream into a single JSON response (handy for tests + curl).
    """
    accept = request.headers.get("accept", "")
    if "application/json" in accept and "text/event-stream" not in accept:
        result: SimulateResponse = await collect_simulation(req)
        return JSONResponse(result.model_dump())

    async def event_iter() -> AsyncIterator[dict]:
        try:
            async for ev in run_simulation_stream(req):
                if await request.is_disconnected():
                    logger.info("simulate: client disconnected")
                    return
                yield {"event": ev.event, "data": json.dumps(ev.data)}
        except asyncio.CancelledError:
            logger.info("simulate: cancelled")
            raise
        except Exception as exc:
            logger.exception("simulate: failed")
            yield {"event": "error", "data": json.dumps({"message": str(exc)})}

    return EventSourceResponse(event_iter())
