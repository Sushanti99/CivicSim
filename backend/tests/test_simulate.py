import json


def test_simulate_json_fallback(client):
    qid = client.get("/api/questions").json()["questions"][0]["question_id"]
    r = client.post(
        "/api/simulate",
        headers={"Accept": "application/json"},
        json={"location": "alameda_california", "n": 5, "seed": 7, "question_id": qid},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["question_id"] == qid
    assert len(body["agents"]) == 5
    assert len(body["responses"]) == 5
    total = sum(d["prob"] for d in body["aggregate"])
    assert abs(total - 1.0) < 1e-6
    # Each response stance is one of the answer_options.
    answers = {d["answer_label"] for d in body["aggregate"]}
    for resp in body["responses"]:
        assert resp["stance"] in answers


def test_simulate_free_text_match(client):
    r = client.post(
        "/api/simulate",
        headers={"Accept": "application/json"},
        json={
            "location": "alameda_california",
            "n": 3,
            "seed": 1,
            "free_text": "climate change affecting my local community",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["matched_from_free_text"] is True
    assert body["question_id"] == "CLIM9_W89"


def test_simulate_free_text_unmatched(client):
    r = client.post(
        "/api/simulate",
        headers={"Accept": "application/json"},
        json={
            "location": "alameda_california",
            "n": 3,
            "free_text": "qzzz nonsense gibberish foo",
        },
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "question_not_found"


def test_simulate_validation_error(client):
    # Neither question_id nor free_text -> 422
    r = client.post(
        "/api/simulate",
        json={"location": "alameda_california", "n": 3},
    )
    assert r.status_code == 422


def test_simulate_sse_event_order(client):
    qid = client.get("/api/questions").json()["questions"][0]["question_id"]
    with client.stream(
        "POST",
        "/api/simulate",
        json={"location": "alameda_california", "n": 3, "seed": 3, "question_id": qid},
    ) as r:
        assert r.status_code == 200
        events: list[tuple[str, dict]] = []
        current_event = None
        for line in r.iter_lines():
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line.split(":", 1)[1].strip()
            elif line.startswith("data:"):
                data = json.loads(line.split(":", 1)[1].strip())
                if current_event:
                    events.append((current_event, data))
                    current_event = None

    names = [e for e, _ in events]
    # First event is "meta", last is "done"
    assert names[0] == "meta"
    assert names[-1] == "done"
    # Three of each per agent for n=3
    assert names.count("agent_sampled") == 3
    assert names.count("prior_attached") == 3
    assert names.count("agent_responded") == 3
    # All agent_sampled events come before all agent_responded events.
    last_sampled = max(i for i, n in enumerate(names) if n == "agent_sampled")
    first_responded = min(i for i, n in enumerate(names) if n == "agent_responded")
    assert last_sampled < first_responded
    # Aggregate appears exactly once, before done.
    assert names.count("aggregate") == 1
    assert names.index("aggregate") < names.index("done")
