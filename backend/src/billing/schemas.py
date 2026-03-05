from typing import Literal

from pydantic import BaseModel, Field


class CreateSubscriptionRequest(BaseModel):
    currency: Literal["inr", "usd"] = "inr"


class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    razorpay_key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str = Field(..., min_length=4, max_length=64)
    razorpay_subscription_id: str = Field(..., min_length=4, max_length=64)
    razorpay_signature: str = Field(..., min_length=16, max_length=256)
