"""Smoke tests — verifies the app boots and baseline endpoints respond."""


def test_health_check(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_docs_available_in_dev(client):
    r = client.get("/docs")
    assert r.status_code == 200
