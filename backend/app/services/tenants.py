"""Tenant onboarding and passwords: run from the CLI, never over the API."""

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.tenant import Tenant, TenantProfile, User

MIN_PASSWORD_LENGTH = 9


class TenantError(ValueError):
    """Bad input, worded for whoever runs the command."""


def _email(value: str) -> str:
    try:
        return TypeAdapter(EmailStr).validate_python(value.strip())
    except ValidationError as exc:
        raise TenantError(f"Invalid email: {value}") from exc


def _password_hash(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise TenantError(f"The password needs at least {MIN_PASSWORD_LENGTH} characters")
    return hash_password(password)


async def create_tenant(
    db: AsyncSession, *, name: str, subdomain: str, email: str, password: str
) -> User:
    """A tenant, its admin and an empty company profile, completed on /settings."""
    email = _email(email)
    name, subdomain = name.strip(), subdomain.strip()
    if not name or not subdomain:
        raise TenantError("The name and the subdomain are required")
    if await db.scalar(select(User).where(User.email == email)):
        raise TenantError(f"Email already registered: {email}")
    if await db.scalar(select(Tenant).where(Tenant.subdomain == subdomain)):
        raise TenantError(f"Subdomain already taken: {subdomain}")

    tenant = Tenant(name=name, subdomain=subdomain)
    db.add(tenant)
    await db.flush()
    db.add(
        TenantProfile(
            tenant_id=tenant.id, company_name=name, address_line1="", postal_code="", city=""
        )
    )
    user = User(tenant_id=tenant.id, email=email, hashed_password=_password_hash(password))
    db.add(user)
    await db.flush()
    return user


async def set_password(
    db: AsyncSession, *, email: str, password: str, sign_out: bool = False
) -> None:
    """With ``sign_out``, every token issued so far stops working: the sessions
    open on other devices end, instead of lasting until their refresh token expires."""
    user = await db.scalar(select(User).where(User.email == _email(email)))
    if user is None:
        raise TenantError(f"No user with the email {email}")
    user.hashed_password = _password_hash(password)
    if sign_out:
        user.token_version += 1
    await db.flush()
