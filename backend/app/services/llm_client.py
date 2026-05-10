"""Provider-agnostic LLM client.

Supports three providers via the ``LLM_PROVIDER`` env var:

* ``mock``      — no external calls. Samples a stance from the supplied prior
                  and emits a templated rationale. Lets the demo work without
                  an API key.
* ``openai``    — uses the OpenAI Chat Completions API.
* ``anthropic`` — uses Anthropic's Messages API.

All providers expose the same async ``respond_as_agent`` surface returning
``(stance, rationale)``.
"""

from __future__ import annotations

import json
import logging
import random
from collections.abc import Iterable
from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.models.poll import AnswerProb

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are simulating a single voter for a research study on public opinion. "
    "Stay in character. Pick exactly one of the listed answer options as your stance, "
    "then give a single-sentence rationale (max 30 words). "
    "Respond ONLY with strict JSON: {\"stance\": <answer>, \"rationale\": <text>}."
)


def _build_user_prompt(
    *,
    persona: dict,
    question: str,
    answer_options: list[str],
    prior: list[AnswerProb],
) -> str:
    persona_str = (
        f"Age bracket: {persona.get('age', 'unknown')}\n"
        f"Race/ethnicity: {persona.get('race', 'unknown')}\n"
        f"Income bracket: {persona.get('income', 'unknown')}\n"
        f"Occupation: {persona.get('occupation', 'unknown')}"
    )
    prior_lines = [f"  - {p.answer_label}: {round(p.prob * 100)}%" for p in prior]
    prior_str = "\n".join(prior_lines) if prior_lines else "  (no prior available)"
    options_str = "\n".join(f"  - {opt}" for opt in answer_options)
    return (
        "Your demographics:\n"
        f"{persona_str}\n\n"
        f"Question: {question}\n\n"
        "Answer options (pick exactly one, verbatim):\n"
        f"{options_str}\n\n"
        "In recent national polling, people in your demographic group answered as follows:\n"
        f"{prior_str}\n\n"
        "Respond as one such person. Output strict JSON: "
        "{\"stance\": <one of the options>, \"rationale\": <one sentence>}."
    )


@dataclass
class LLMReply:
    stance: str
    rationale: str


class LLMClient:
    async def respond_as_agent(
        self,
        *,
        persona: dict,
        question: str,
        answer_options: list[str],
        prior: list[AnswerProb],
        model: str | None = None,
    ) -> LLMReply:
        raise NotImplementedError


class MockLLMClient(LLMClient):
    """Deterministic-ish stand-in: sample stance from the prior, template a rationale."""

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)

    async def respond_as_agent(
        self,
        *,
        persona: dict,
        question: str,
        answer_options: list[str],
        prior: list[AnswerProb],
        model: str | None = None,
    ) -> LLMReply:
        if prior:
            options = [p.answer_label for p in prior if p.answer_label in answer_options]
            weights = [p.prob for p in prior if p.answer_label in answer_options]
            if not options:
                options, weights = answer_options, [1.0] * len(answer_options)
        else:
            options, weights = answer_options, [1.0] * len(answer_options)
        stance = self._rng.choices(options, weights=weights, k=1)[0]
        rationale = (
            f"As a {persona.get('age', 'voter')} {persona.get('race', '').lower()} "
            f"{persona.get('occupation', '').split(':')[0].lower()}, "
            f"this answer matches what people in my situation tend to say."
        )
        return LLMReply(stance=stance, rationale=rationale)


class OpenAILLMClient(LLMClient):
    def __init__(self, api_key: str, default_model: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)
        self._default_model = default_model

    async def respond_as_agent(
        self,
        *,
        persona: dict,
        question: str,
        answer_options: list[str],
        prior: list[AnswerProb],
        model: str | None = None,
    ) -> LLMReply:
        prompt = _build_user_prompt(
            persona=persona, question=question, answer_options=answer_options, prior=prior
        )
        resp = await self._client.chat.completions.create(
            model=model or self._default_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=200,
        )
        content = resp.choices[0].message.content or "{}"
        return _parse_reply(content, answer_options)


class AnthropicLLMClient(LLMClient):
    def __init__(self, api_key: str, default_model: str) -> None:
        import anthropic

        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._default_model = default_model

    async def respond_as_agent(
        self,
        *,
        persona: dict,
        question: str,
        answer_options: list[str],
        prior: list[AnswerProb],
        model: str | None = None,
    ) -> LLMReply:
        prompt = _build_user_prompt(
            persona=persona, question=question, answer_options=answer_options, prior=prior
        )
        resp = await self._client.messages.create(
            model=model or self._default_model,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
        )
        text = "".join(getattr(b, "text", "") for b in resp.content)
        return _parse_reply(text, answer_options)


def _parse_reply(raw: str, answer_options: Iterable[str]) -> LLMReply:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`").split("\n", 1)[-1]
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        # Fall back: try to find the first {...} block.
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            try:
                obj = json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                obj = {}
        else:
            obj = {}
    stance = str(obj.get("stance", "")).strip()
    rationale = str(obj.get("rationale", "")).strip()

    options = list(answer_options)
    if stance not in options:
        # Snap to the closest case-insensitive match, else first option.
        lower_map = {o.lower(): o for o in options}
        if stance.lower() in lower_map:
            stance = lower_map[stance.lower()]
        else:
            logger.warning("LLM returned out-of-vocab stance %r; snapping to first option", stance)
            stance = options[0] if options else stance

    if not rationale:
        rationale = "(no rationale provided)"
    return LLMReply(stance=stance, rationale=rationale)


def build_llm_client(settings: Settings | None = None) -> LLMClient:
    settings = settings or get_settings()
    provider = settings.llm_provider
    if provider == "mock":
        return MockLLMClient()
    if provider == "openai":
        if not settings.openai_api_key:
            logger.warning("LLM_PROVIDER=openai but OPENAI_API_KEY missing; falling back to mock")
            return MockLLMClient()
        return OpenAILLMClient(api_key=settings.openai_api_key, default_model=settings.llm_model)
    if provider == "anthropic":
        if not settings.anthropic_api_key:
            logger.warning(
                "LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY missing; falling back to mock"
            )
            return MockLLMClient()
        return AnthropicLLMClient(
            api_key=settings.anthropic_api_key, default_model=settings.llm_model
        )
    raise ValueError(f"Unknown LLM_PROVIDER {provider!r}")
