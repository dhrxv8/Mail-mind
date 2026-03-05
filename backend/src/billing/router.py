"""
Billing router — Razorpay integration

POST /billing/create-subscription   create a Razorpay subscription (free -> pro)
POST /billing/verify-payment        verify Razorpay payment signature and activate pro
POST /billing/cancel-subscription   cancel the active Razorpay subscription
POST /billing/webhook               receive and process Razorpay webhook events
"""

import hashlib
import hmac
import json
import logging

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.billing.schemas import (
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    VerifyPaymentRequest,
)
from src.config import get_settings
from src.database import get_db
from src.models.user import Plan, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

_rz_client: razorpay.Client | None = None


def _get_razorpay_client() -> razorpay.Client:
    global _rz_client
    if not settings.RAZORPAY_KEY_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server.",
        )
    if _rz_client is None:
        _rz_client = razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )
    return _rz_client


# -- POST /billing/create-subscription --------------------------------------

@router.post("/create-subscription", response_model=CreateSubscriptionResponse)
@limiter.limit("10/minute")
async def create_subscription(
    request: Request,
    body: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreateSubscriptionResponse:
    """Create a Razorpay subscription for upgrading to Pro."""
    client = _get_razorpay_client()

    if current_user.plan == Plan.pro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already on the Pro plan.",
        )

    plan_id = (
        settings.RAZORPAY_PLAN_ID_INR
        if body.currency.lower() == "inr"
        else settings.RAZORPAY_PLAN_ID_USD
    )

    if not plan_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No Razorpay plan configured for currency: {body.currency}",
        )

    customer_id = current_user.razorpay_customer_id
    if not customer_id:
        customer = client.customer.create(
            {
                "name": current_user.name or "",
                "email": current_user.email,
                "notes": {"user_id": str(current_user.id)},
            }
        )
        customer_id = customer["id"]
        current_user.razorpay_customer_id = customer_id
        db.commit()

    subscription = client.subscription.create(
        {
            "plan_id": plan_id,
            "customer_id": customer_id,
            "total_count": 120,
            "notes": {"user_id": str(current_user.id)},
        }
    )

    return CreateSubscriptionResponse(
        subscription_id=subscription["id"],
        razorpay_key_id=settings.RAZORPAY_KEY_ID,
    )


# -- POST /billing/verify-payment -------------------------------------------

@router.post("/verify-payment")
@limiter.limit("10/minute")
async def verify_payment(
    request: Request,
    body: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Verify the Razorpay payment signature and upgrade the user to Pro."""
    client = _get_razorpay_client()

    expected_signature = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f"{body.razorpay_payment_id}|{body.razorpay_subscription_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, body.razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment signature.",
        )

    current_user.plan = Plan.pro
    current_user.razorpay_subscription_id = body.razorpay_subscription_id
    db.commit()

    log.info(
        "User %s upgraded to Pro (subscription=%s)",
        current_user.id,
        body.razorpay_subscription_id,
    )

    return {"status": "ok", "plan": "pro"}


# -- POST /billing/cancel-subscription --------------------------------------

@router.post("/cancel-subscription")
@limiter.limit("5/minute")
async def cancel_subscription(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Cancel the user's active Razorpay subscription."""
    client = _get_razorpay_client()

    if current_user.plan != Plan.pro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not on the Pro plan.",
        )

    sub_id = current_user.razorpay_subscription_id
    if not sub_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active subscription found.",
        )

    try:
        client.subscription.cancel(sub_id, {"cancel_at_cycle_end": 0})
    except Exception:
        log.exception("Razorpay subscription cancel failed for sub=%s", sub_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to cancel subscription. Please try again.",
        )

    current_user.plan = Plan.free
    current_user.razorpay_subscription_id = None
    db.commit()

    log.info("User %s cancelled subscription %s", current_user.id, sub_id)
    return {"status": "ok", "plan": "free"}


# -- POST /billing/webhook --------------------------------------------------

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Receive and process Razorpay webhook events."""
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    payload = await request.body()
    sig_header = request.headers.get("x-razorpay-signature", "")

    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, sig_header):
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = json.loads(payload)
    event_type: str = event.get("event", "")
    entity = (
        event.get("payload", {})
        .get("subscription", {})
        .get("entity", {})
    )

    if event_type == "subscription.activated":
        _handle_activated(db, entity)
    elif event_type in ("subscription.cancelled", "subscription.halted"):
        _handle_cancelled(db, entity)
    else:
        log.debug("Unhandled Razorpay event: %s", event_type)

    return {"received": True}


def _handle_activated(db: Session, subscription: dict) -> None:
    customer_id: str = subscription.get("customer_id") or ""
    subscription_id: str = subscription.get("id") or ""
    notes: dict = subscription.get("notes", {})
    user_id: str = notes.get("user_id", "")

    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    if not user and customer_id:
        user = db.query(User).filter(User.razorpay_customer_id == customer_id).first()

    if not user:
        log.warning("subscription.activated: user not found customer=%s", customer_id)
        return

    user.plan = Plan.pro
    user.razorpay_subscription_id = subscription_id
    db.commit()
    log.info("User %s activated Pro via webhook (sub=%s)", user.id, subscription_id)


def _handle_cancelled(db: Session, subscription: dict) -> None:
    customer_id: str = subscription.get("customer_id") or ""
    subscription_id: str = subscription.get("id") or ""

    user = (
        db.query(User)
        .filter(User.razorpay_subscription_id == subscription_id)
        .first()
    )
    if not user and customer_id:
        user = db.query(User).filter(User.razorpay_customer_id == customer_id).first()

    if not user:
        log.warning("subscription.cancelled: user not found sub=%s", subscription_id)
        return

    user.plan = Plan.free
    user.razorpay_subscription_id = None
    db.commit()
    log.info("User %s downgraded to Free via webhook (sub=%s)", user.id, subscription_id)
