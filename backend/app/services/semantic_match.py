"""Semantic free-text → ATP question matching via OpenAI embeddings.

Falls back to improved token-overlap (Jaccard on non-stopwords) when the
OpenAI key is unavailable (e.g. mock mode).
"""

from __future__ import annotations

import logging
import math
import threading
from functools import lru_cache

logger = logging.getLogger(__name__)

# Cosine similarity thresholds for text-embedding-3-small.
CLOSE_THRESHOLD = 0.62
WEAK_THRESHOLD = 0.48

# Jaccard thresholds used by the token-overlap fallback.
_FALLBACK_CLOSE = 0.12
_FALLBACK_WEAK = 0.04

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "should",
    "could", "may", "might", "shall", "can", "need", "dare", "ought",
    "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
    "into", "through", "about", "against", "between", "during", "without",
    "before", "after", "above", "below", "up", "down", "out", "off",
    "over", "under", "again", "there", "here", "when", "where", "why",
    "how", "what", "which", "who", "whom", "this", "that", "these", "those",
    "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
    "not", "no", "its", "it", "he", "she", "they", "we", "you", "i",
    "my", "your", "his", "her", "our", "their", "than", "then", "such",
    "more", "most", "also", "just", "own", "same", "too", "very", "any",
    "all", "each", "few", "if", "whether", "federal", "government",
    "united", "states", "american", "new", "make", "get",
}

_embed_lock = threading.Lock()
_question_embeddings: dict[str, list[float]] | None = None  # qid -> embedding


def _tokenize_no_stop(s: str) -> set[str]:
    tokens: set[str] = set()
    cur: list[str] = []
    for ch in s.lower():
        if ch.isalnum():
            cur.append(ch)
        elif cur:
            word = "".join(cur)
            if len(word) > 2 and word not in _STOPWORDS:
                tokens.add(word)
            cur = []
    if cur:
        word = "".join(cur)
        if len(word) > 2 and word not in _STOPWORDS:
            tokens.add(word)
    return tokens


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _openai_client():
    from openai import OpenAI
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    return OpenAI(api_key=settings.openai_api_key)


@lru_cache(maxsize=1)
def _client_available() -> bool:
    return _openai_client() is not None


def _embed_batch(texts: list[str]) -> list[list[float]]:
    client = _openai_client()
    if client is None:
        raise RuntimeError("OpenAI key not set")
    resp = client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in sorted(resp.data, key=lambda x: x.index)]


def _load_question_embeddings(questions: list[tuple[str, str]]) -> dict[str, list[float]]:
    """Pre-compute and cache embeddings for all ATP questions."""
    global _question_embeddings
    with _embed_lock:
        if _question_embeddings is not None:
            return _question_embeddings

        logger.info("Pre-computing ATP question embeddings (%d questions)…", len(questions))
        labels = [lbl for _, lbl in questions]
        embeddings = _embed_batch(labels)
        _question_embeddings = {qid: emb for (qid, _), emb in zip(questions, embeddings)}
        logger.info("ATP question embeddings cached.")
        return _question_embeddings


def semantic_match(query: str, questions: list[tuple[str, str]]) -> tuple[str | None, float]:
    """Return (best_question_id, similarity_score) using embedding cosine similarity.

    Falls back to Jaccard-on-non-stopwords if the OpenAI key is unavailable.
    questions: list of (question_id, question_label).
    """
    if not questions:
        return None, 0.0

    if _client_available():
        return _semantic_match_embed(query, questions)
    else:
        return _semantic_match_fallback(query, questions)


def _semantic_match_embed(
    query: str, questions: list[tuple[str, str]]
) -> tuple[str | None, float]:
    try:
        q_emb = _embed_batch([query])[0]
        cached = _load_question_embeddings(questions)
        best_id, best_score = None, 0.0
        for qid, emb in cached.items():
            score = _cosine(q_emb, emb)
            if score > best_score:
                best_id, best_score = qid, score
        return best_id, best_score
    except Exception as exc:
        logger.warning("Embedding match failed (%s), falling back to token overlap.", exc)
        return _semantic_match_fallback(query, questions)


def _semantic_match_fallback(
    query: str, questions: list[tuple[str, str]]
) -> tuple[str | None, float]:
    q_tokens = _tokenize_no_stop(query)
    if not q_tokens:
        return None, 0.0
    best_id, best_score = None, 0.0
    for qid, lbl in questions:
        t = _tokenize_no_stop(lbl)
        union = q_tokens | t
        if not union:
            continue
        jaccard = len(q_tokens & t) / len(union)
        if jaccard > best_score:
            best_id, best_score = qid, jaccard
    return best_id, best_score


def match_level(score: float, *, using_embeddings: bool) -> str:
    """Map a similarity score to 'close' | 'weak' | 'none'."""
    close = CLOSE_THRESHOLD if using_embeddings else _FALLBACK_CLOSE
    weak = WEAK_THRESHOLD if using_embeddings else _FALLBACK_WEAK
    if score >= close:
        return "close"
    if score >= weak:
        return "weak"
    return "none"
