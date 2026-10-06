import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    verify_unknown_user,
)
from app.models.tenant import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None:
        verify_unknown_user(body.password)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        user_id, version = decode_token(body.refresh_token, "refresh")
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if version != user.token_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Signed out")

    return _tokens(user)


def _tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.token_version),
        refresh_token=create_refresh_token(str(user.id), user.token_version),
    )
