"""
Shared fixtures for the MailMind test suite.

Uses an in-memory SQLite database (via StaticPool so every session shares
the same connection) and mocks the arq Redis pool so tests never need a
running PostgreSQL or Redis instance.
"""

import os
import uuid as uuid_mod
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import sqltypes

# ── SQLite compat: let the Uuid type accept plain strings ─────────────────────
# Production uses PostgreSQL which handles str→UUID natively; SQLite does not.
_orig_uuid_bind_processor = sqltypes.Uuid.bind_processor


def _patched_uuid_bind_processor(self, dialect):
    orig_fn = _orig_uuid_bind_processor(self, dialect)
    if orig_fn is None:
        return None

    def process(value):
        if value is not None and isinstance(value, str):
            try:
                value = uuid_mod.UUID(value)
            except ValueError:
                pass
        return orig_fn(value)

    return process


sqltypes.Uuid.bind_processor = _patched_uuid_bind_processor

# ── Test environment (must precede any app import) ────────────────────────────

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-at-least-32-chars-long")
os.environ.setdefault("ENCRYPTION_KEY", "QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("RAZORPAY_KEY_ID", "rzp_test_key")
os.environ.setdefault("RAZORPAY_KEY_SECRET", "rzp_test_secret")
os.environ.setdefault("RAZORPAY_PLAN_ID_INR", "plan_inr_123")
os.environ.setdefault("RAZORPAY_PLAN_ID_USD", "plan_usd_456")
os.environ.setdefault("RAZORPAY_WEBHOOK_SECRET", "whsec_test")

from main import app  # noqa: E402
from src.database import Base, get_db  # noqa: E402
from src.models.gmail_account import GmailAccount  # noqa: E402
from src.models.user import User  # noqa: E402

# ── In-memory SQLite (shared single connection via StaticPool) ────────────────

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

_TABLES = [User.__table__, GmailAccount.__table__]


@event.listens_for(_engine, "connect")
def _enable_fk(dbapi_conn, _rec):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def _get_test_db():
    session = _TestSession()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = _get_test_db


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _tables():
    """Create the required tables before each test; drop them after."""
    Base.metadata.create_all(bind=_engine, tables=_TABLES)
    yield
    Base.metadata.drop_all(bind=_engine, tables=_TABLES)


@pytest.fixture(autouse=True)
def _reset_billing_client():
    """Prevent the module-level Razorpay client from leaking between tests."""
    yield
    import src.billing.router as _mod
    _mod._rz_client = None


@pytest.fixture()
def db():
    """Provide a test DB session for setting up data in tests."""
    session = _TestSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    """TestClient with arq Redis mocked out (no real Redis required)."""
    mock_pool = AsyncMock()
    mock_pool.ping.return_value = True
    mock_pool.close = AsyncMock()
    mock_pool.enqueue_job = AsyncMock()

    mock_create_pool = AsyncMock(return_value=mock_pool)

    with patch("main.create_pool", mock_create_pool):
        with TestClient(app) as c:
            yield c


