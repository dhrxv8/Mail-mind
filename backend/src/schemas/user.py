import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr

from src.models.user import Plan


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    avatar_url: Optional[str]
    plan: Plan
    created_at: datetime

    model_config = {"from_attributes": True}
