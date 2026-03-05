from pydantic import BaseModel


class AuthStatusResponse(BaseModel):
    authenticated: bool
