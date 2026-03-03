from pydantic import BaseModel


class CheckoutSessionResponse(BaseModel):
    url: str


class BillingPortalResponse(BaseModel):
    url: str
