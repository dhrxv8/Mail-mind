"""
Billing router — Phase 7

POST /billing/create-checkout   create a Stripe Checkout session (free → pro)
POST /billing/webhook           receive and process Stripe webhook events
GET  /billing/portal            create a Stripe Customer Portal session
"""

from __future__ import annotations

import logging
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.billing.schemas import BillingPortalResponse, CheckoutSessionResponse
from src.config import get_settings
from src.database import get_db
from src.models.user import Plan, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])
settings = get_settings()


def _require_stripe() -> None:
    """Raise 503 if Stripe is not configured in this environment."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured on this server.",
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY


# ── POST /billing/create-checkout ─────────────────────────────────────────────

@router.post("/create-checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout session for upgrading to Pro."""
    _require_stripe()

    if current_user.plan == Plan.pro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already on the Pro plan.",
        )

    # Get or create a Stripe Customer for this user
    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.name,
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer["id"]
        current_user.stripe_customer_id = customer_id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": settings.STRIPE_PRICE_ID_PRO, "quantity": 1}],
        mode="subscription",
        success_url=f"{settings.FRONTEND_URL}/settings?upgrade=success",
        cancel_url=f"{settings.FRONTEND_URL}/settings?upgrade=cancelled",
        metadata={"user_id": str(current_user.id)},
    )

    return CheckoutSessionResponse(url=session["url"])


# ── POST /billing/webhook ─────────────────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """Receive and process Stripe webhook events."""
    _require_stripe()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    event_type: str = event["type"]
    data: Any = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, data)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(db, data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(db, data)
    else:
        log.debug("Unhandled Stripe event: %s", event_type)

    return {"received": True}


def _handle_checkout_completed(db: Session, session: Any) -> None:
    customer_id: str = session.get("customer") or ""
    subscription_id: str = session.get("subscription") or ""
    user_id: str = (session.get("metadata") or {}).get("user_id", "")

    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    if not user and customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()

    if not user:
        log.warning(
            "checkout.session.completed: user not found customer=%s", customer_id
        )
        return

    user.plan = Plan.pro
    user.stripe_customer_id = customer_id
    user.stripe_subscription_id = subscription_id
    db.commit()
    log.info("User %s upgraded to Pro (subscription=%s)", user.id, subscription_id)


def _handle_subscription_updated(db: Session, subscription: Any) -> None:
    sub_status: str = subscription.get("status") or ""
    customer_id: str = subscription.get("customer") or ""
    subscription_id: str = subscription.get("id") or ""

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        log.warning(
            "subscription.updated: user not found customer=%s", customer_id
        )
        return

    if sub_status in ("active", "trialing"):
        user.plan = Plan.pro
        user.stripe_subscription_id = subscription_id
    elif sub_status in ("canceled", "unpaid", "past_due", "incomplete_expired"):
        user.plan = Plan.free
        user.stripe_subscription_id = None

    db.commit()
    log.info(
        "User %s subscription status=%s → plan=%s", user.id, sub_status, user.plan
    )


def _handle_subscription_deleted(db: Session, subscription: Any) -> None:
    customer_id: str = subscription.get("customer") or ""

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        log.warning(
            "subscription.deleted: user not found customer=%s", customer_id
        )
        return

    user.plan = Plan.free
    user.stripe_subscription_id = None
    db.commit()
    log.info("User %s downgraded to Free (subscription deleted)", user.id)


# ── GET /billing/portal ────────────────────────────────────────────────────────

@router.get("/portal", response_model=BillingPortalResponse)
async def create_billing_portal(
    current_user: User = Depends(get_current_user),
) -> BillingPortalResponse:
    """Create a Stripe Customer Portal session for managing an existing subscription."""
    _require_stripe()

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Please upgrade first.",
        )

    portal_session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/settings",
    )

    return BillingPortalResponse(url=portal_session["url"])
