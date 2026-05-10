def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["atp_priors_present"] is True


def test_locations(client):
    r = client.get("/api/locations")
    assert r.status_code == 200
    body = r.json()
    ids = [loc["id"] for loc in body["locations"]]
    assert "alameda_california" in ids


def test_agents_shape(client):
    r = client.post("/api/agents", json={"location": "alameda_california", "n": 5, "seed": 42})
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 5
    assert len(body["agents"]) == 5
    a0 = body["agents"][0]
    assert {"agent_id", "age", "race", "income", "occupation"} <= set(a0)


def test_agents_unknown_location(client):
    r = client.post("/api/agents", json={"location": "atlantis", "n": 5})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "location_not_found"


def test_agents_validation(client):
    r = client.post("/api/agents", json={"location": "alameda_california", "n": 0})
    assert r.status_code == 422
