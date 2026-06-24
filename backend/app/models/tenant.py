import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import UUIDBase


class Tenant(UUIDBase):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(63), unique=True, nullable=False)

    profile: Mapped[TenantProfile] = relationship(back_populates="tenant", uselist=False)
    users: Mapped[list[User]] = relationship(back_populates="tenant")


class TenantProfile(UUIDBase):
    __tablename__ = "tenant_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[str | None] = mapped_column(String(255))
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False, default="CH")
    iban: Mapped[str | None] = mapped_column(String(34))
    vat_number: Mapped[str | None] = mapped_column(String(20))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    # null = non-assujetti TVA (CA < CHF 100k)
    default_vat_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    invoice_prefix: Mapped[str] = mapped_column(String(10), nullable=False, default="INV")
    invoice_next_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    tenant: Mapped[Tenant] = relationship(back_populates="profile")


class User(UUIDBase):
    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    tenant: Mapped[Tenant] = relationship(back_populates="users")
