"""Smoke test — verifies the app boots and the health endpoint responds."""

import os

import pytest
from fastapi.testclient import TestClient

# Provide minimal env vars so Settings validation passes without a .env file
os.environ.setdefault("DATABASE_URL", "postgresql://mailmind:mailmind_dev@localhost:5432/mailmind")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-at-least-32-chars-long")
os.environ.setdefault("ENCRYPTION_KEY", "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=")  # b"A"*32 → 32 bytes
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")

from main import app  # noqa: E402 — import after env setup

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_docs_available_in_dev():
    response = client.get("/docs")
    assert response.status_code == 200
