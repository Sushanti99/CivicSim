"""Aggregate per-agent stances into a distribution."""

from __future__ import annotations

from collections import Counter

from app.models.poll import AnswerProb


def aggregate_stances(stances: list[str], answer_options: list[str]) -> list[AnswerProb]:
    if not stances:
        return [AnswerProb(answer_label=a, prob=0.0) for a in answer_options]
    counts = Counter(stances)
    total = sum(counts.values())
    return [
        AnswerProb(answer_label=a, prob=counts.get(a, 0) / total)
        for a in answer_options
    ]
