"""
Billing tests — Razorpay create / verify / cancel subscription + webhook.

All Razorpay API calls are mocked via unittest.mock (pytest-mock compatible).
"""

import hashlib
import hmac
import json
from unittest.mock import MagicMock, patch

from helpers import auth_cookies, make_user
from src.config import get_settings
from src.models.user import Plan

settings = get_settings()


def _razorpay_mock(**overrides) -> MagicMock:
    """Build a mock Razorpay client with sane defaults."""
    client = MagicMock()
    client.customer.create.return_value = {"id": "cust_test_1"}
    client.subscription.create.return_value = {"id": "sub_test_1"}
    client.subscription.cancel.return_value = {"id": "sub_test_1"}
    for k, v in overrides.items():
        attr = client
        *path, last = k.split(".")
        for part in path:
            attr = getattr(attr, part)
        setattr(attr, last, v)
    return client


def _webhook_payload(event_type: str, entity: dict) -> tuple[bytes, str]:
    """Return (body_bytes, signature) for a valid Razorpay webhook."""
    body = json.dumps({
        "event": event_type,
        "payload": {"subscription": {"entity": entity}},
    }).encode()
    sig = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return body, sig


# ── POST /billing/create-subscription ─────────────────────────────────────────


def test_create_subscription_for_free_user(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post(
            "/billing/create-subscription",
            json={"currency": "inr"},
            cookies=cookies,
        )

    assert r.status_code == 200
    data = r.json()
    assert data["subscription_id"] == "sub_test_1"
    assert data["razorpay_key_id"] == settings.RAZORPAY_KEY_ID


def test_create_subscription_usd_currency(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post(
            "/billing/create-subscription",
            json={"currency": "usd"},
            cookies=cookies,
        )

    assert r.status_code == 200


def test_create_subscription_already_pro_returns_400(client, db):
    user = make_user(db, plan=Plan.pro)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post(
            "/billing/create-subscription",
            json={"currency": "inr"},
            cookies=cookies,
        )

    assert r.status_code == 400
    assert "already" in r.json()["detail"].lower()


def test_create_subscription_unauthenticated_returns_401(client):
    r = client.post("/billing/create-subscription", json={"currency": "inr"})
    assert r.status_code == 401


# ── POST /billing/verify-payment ──────────────────────────────────────────────


def _make_valid_signature(payment_id: str, sub_id: str) -> str:
    return hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{payment_id}|{sub_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def test_verify_payment_upgrades_to_pro(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))
    payment_id = "pay_test_1"
    sub_id = "sub_test_1"
    sig = _make_valid_signature(payment_id, sub_id)

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post(
            "/billing/verify-payment",
            json={
                "razorpay_payment_id": payment_id,
                "razorpay_subscription_id": sub_id,
                "razorpay_signature": sig,
            },
            cookies=cookies,
        )

    assert r.status_code == 200
    assert r.json()["plan"] == "pro"

    db.expire_all()
    user_fresh = db.query(type(user)).filter_by(id=user.id).first()
    assert user_fresh.plan == Plan.pro
    assert user_fresh.razorpay_subscription_id == sub_id


def test_verify_payment_bad_signature_returns_400(client, db):
    user = make_user(db)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post(
            "/billing/verify-payment",
            json={
                "razorpay_payment_id": "pay_1",
                "razorpay_subscription_id": "sub_1",
                "razorpay_signature": "a" * 64,
            },
            cookies=cookies,
        )

    assert r.status_code == 400
    assert "signature" in r.json()["detail"].lower()


# ── POST /billing/cancel-subscription ─────────────────────────────────────────


def test_cancel_subscription_downgrades_to_free(client, db):
    user = make_user(
        db,
        plan=Plan.pro,
        razorpay_customer_id="cust_1",
        razorpay_subscription_id="sub_1",
    )
    cookies = auth_cookies(str(user.id))

    mock_client = _razorpay_mock()
    with patch("src.billing.router._get_razorpay_client", return_value=mock_client):
        r = client.post("/billing/cancel-subscription", cookies=cookies)

    assert r.status_code == 200
    assert r.json()["plan"] == "free"
    mock_client.subscription.cancel.assert_called_once_with("sub_1", {"cancel_at_cycle_end": 0})

    db.expire_all()
    user_fresh = db.query(type(user)).filter_by(id=user.id).first()
    assert user_fresh.plan == Plan.free
    assert user_fresh.razorpay_subscription_id is None


def test_cancel_subscription_free_user_returns_400(client, db):
    user = make_user(db, plan=Plan.free)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post("/billing/cancel-subscription", cookies=cookies)

    assert r.status_code == 400
    assert "not on the pro" in r.json()["detail"].lower()


def test_cancel_subscription_no_sub_id_returns_400(client, db):
    user = make_user(db, plan=Plan.pro, razorpay_subscription_id=None)
    cookies = auth_cookies(str(user.id))

    with patch("src.billing.router._get_razorpay_client", return_value=_razorpay_mock()):
        r = client.post("/billing/cancel-subscription", cookies=cookies)

    assert r.status_code == 400
    assert "no active subscription" in r.json()["detail"].lower()


def test_cancel_subscription_razorpay_error_returns_502(client, db):
    user = make_user(
        db,
        plan=Plan.pro,
        razorpay_subscription_id="sub_bad",
    )
    cookies = auth_cookies(str(user.id))

    mock_client = _razorpay_mock()
    mock_client.subscription.cancel.side_effect = Exception("Razorpay down")

    with patch("src.billing.router._get_razorpay_client", return_value=mock_client):
        r = client.post("/billing/cancel-subscription", cookies=cookies)

    assert r.status_code == 502


# ── POST /billing/webhook ────────────────────────────────────────────────────


def test_webhook_subscription_activated(client, db):
    user = make_user(db)
    body, sig = _webhook_payload(
        "subscription.activated",
        {"id": "sub_wh_1", "customer_id": "cust_wh_1", "notes": {"user_id": str(user.id)}},
    )

    r = client.post(
        "/billing/webhook",
        content=body,
        headers={"x-razorpay-signature": sig, "content-type": "application/json"},
    )

    assert r.status_code == 200
    db.expire_all()
    user_fresh = db.query(type(user)).filter_by(id=user.id).first()
    assert user_fresh.plan == Plan.pro
    assert user_fresh.razorpay_subscription_id == "sub_wh_1"


def test_webhook_subscription_cancelled(client, db):
    user = make_user(
        db,
        plan=Plan.pro,
        razorpay_customer_id="cust_wh_2",
        razorpay_subscription_id="sub_wh_2",
    )
    body, sig = _webhook_payload(
        "subscription.cancelled",
        {"id": "sub_wh_2", "customer_id": "cust_wh_2"},
    )

    r = client.post(
        "/billing/webhook",
        content=body,
        headers={"x-razorpay-signature": sig, "content-type": "application/json"},
    )

    assert r.status_code == 200
    db.expire_all()
    user_fresh = db.query(type(user)).filter_by(id=user.id).first()
    assert user_fresh.plan == Plan.free
    assert user_fresh.razorpay_subscription_id is None


def test_webhook_invalid_signature_returns_400(client):
    body = b'{"event":"subscription.activated","payload":{}}'
    r = client.post(
        "/billing/webhook",
        content=body,
        headers={"x-razorpay-signature": "bad_sig", "content-type": "application/json"},
    )

    assert r.status_code == 400
    assert "signature" in r.json()["detail"].lower()
