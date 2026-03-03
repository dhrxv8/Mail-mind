from fastapi import APIRouter, Depends

from src.auth.dependencies import get_current_user
from src.models.user import User
from src.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
