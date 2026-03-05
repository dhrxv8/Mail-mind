from pydantic import BaseModel


class CreateSubscriptionRequest(BaseModel):
    currency: str = "inr"


class CreateSubscriptionResponse(BaseModel):
    subscription_id: str
    razorpay_key_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str
