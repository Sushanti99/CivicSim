def test_questions_endpoint(client):
    r = client.get("/api/questions")
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert len(qs) >= 1
    q0 = qs[0]
    assert {"question_id", "question_label", "answer_labels"} <= set(q0)


def test_poll_basic(client):
    qid = client.get("/api/questions").json()["questions"][0]["question_id"]
    r = client.post("/api/poll", json={"question_id": qid})
    assert r.status_code == 200
    body = r.json()
    assert body["question_id"] == qid
    total = sum(d["prob"] for d in body["distribution"])
    assert abs(total - 1.0) < 1e-6


def test_poll_with_filter_and_no_backoff_when_present(client):
    qid = client.get("/api/questions").json()["questions"][0]["question_id"]
    r = client.post(
        "/api/poll",
        json={
            "question_id": qid,
            "demographic_filter": {"age_group": "30-49"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["used_filter"]["age_group"] == "30-49"
    assert body["backoff_steps"] == []


def test_poll_backoff_when_cell_missing(client):
    qid = client.get("/api/questions").json()["questions"][0]["question_id"]
    # Synthetic priors only have single-dim and (age x race) two-dim cells.
    # Setting urbanicity + income should force backoff.
    r = client.post(
        "/api/poll",
        json={
            "question_id": qid,
            "demographic_filter": {"urbanicity": "urban", "income_group": "below_30000"},
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert "urbanicity" in body["backoff_steps"]
    assert body["used_filter"]["urbanicity"] == "ALL"


def test_poll_unknown_question(client):
    r = client.post("/api/poll", json={"question_id": "DOES_NOT_EXIST"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "question_not_found"
