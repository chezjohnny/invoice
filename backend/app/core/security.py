from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
import jwt
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

# bcrypt is slow on purpose (some 0.2 s), to slow down password guessing: it runs
# in a thread, so that the event loop keeps serving the other requests meanwhile.


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def hash_password(password: str) -> str:
    return await run_in_threadpool(_hash, password)


async def verify_password(plain: str, hashed: str) -> bool:
    return await run_in_threadpool(bcrypt.checkpw, plain.encode(), hashed.encode())


# Checked against when the email is unknown, so that a login takes as long
# either way and does not tell which addresses have an account.
_UNKNOWN_USER_HASH = _hash("no account has this password")


async def verify_unknown_user(plain: str) -> None:
    await verify_password(plain, _UNKNOWN_USER_HASH)


# The type claim keeps the two apart: a 7-day refresh token must not open the
# API, and a 30-minute access token must not be traded for new tokens.
TokenType = Literal["access", "refresh"]


def create_token(
    subject: str, version: int, token_type: TokenType, expires_delta: timedelta
) -> str:
    expire = datetime.now(UTC) + expires_delta
    return jwt.encode(
        {"sub": subject, "ver": version, "type": token_type, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )


def create_access_token(user_id: str, version: int) -> str:
    delta = timedelta(minutes=settings.access_token_expire_minutes)
    return create_token(user_id, version, "access", delta)


def create_refresh_token(user_id: str, version: int) -> str:
    delta = timedelta(days=settings.refresh_token_expire_days)
    return create_token(user_id, version, "refresh", delta)


def decode_token(token: str, expected_type: TokenType) -> tuple[str, int]:
    """The user id and token version of a valid token of this type; raises
    jwt.PyJWTError otherwise."""
    payload = jwt.decode(
        token, settings.secret_key, algorithms=[settings.algorithm], options={"require": ["exp"]}
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Not an {expected_type} token")
    # Tokens issued before versions existed carry none: version 0.
    return str(payload["sub"]), int(payload.get("ver", 0))
