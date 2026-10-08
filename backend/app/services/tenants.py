"""Tenant onboarding and passwords: run from the CLI, never over the API."""

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

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


def create_tenant(db: Session, *, name: str, subdomain: str, email: str, password: str) -> User:
    """A tenant, its admin and an empty company profile, completed on /settings."""
    email = _email(email)
    name, subdomain = name.strip(), subdomain.strip()
    if not name or not subdomain:
        raise TenantError("The name and the subdomain are required")
    if db.scalar(select(User).where(User.email == email)):
        raise TenantError(f"Email already registered: {email}")
    if db.scalar(select(Tenant).where(Tenant.subdomain == subdomain)):
        raise TenantError(f"Subdomain already taken: {subdomain}")

    tenant = Tenant(name=name, subdomain=subdomain)
    db.add(tenant)
    db.flush()
    db.add(
        TenantProfile(
            tenant_id=tenant.id, company_name=name, address_line1="", postal_code="", city=""
        )
    )
    user = User(tenant_id=tenant.id, email=email, hashed_password=_password_hash(password))
    db.add(user)
    db.flush()
    return user


def set_password(db: Session, *, email: str, password: str, sign_out: bool = False) -> None:
    """With ``sign_out``, every token issued so far stops working: the sessions
    open on other devices end. Without it they go on, each refresh renewing them."""
    user = db.scalar(select(User).where(User.email == _email(email)))
    if user is None:
        raise TenantError(f"No user with the email {email}")
    user.hashed_password = _password_hash(password)
    if sign_out:
        user.token_version += 1
    db.flush()
