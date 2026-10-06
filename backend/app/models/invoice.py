from __future__ import annotations

import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import UUIDBase


class InvoiceStatus(enum.StrEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentMethod(enum.StrEnum):
    CASH = "cash"
    TWINT = "twint"
    IBAN = "iban"


class Invoice(UUIDBase):
    __tablename__ = "invoices"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
    )
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus, name="invoice_status"),
        nullable=False,
        default=InvoiceStatus.DRAFT,
    )
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method"), nullable=True
    )
    discount_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0")
    )
    notes: Mapped[str] = mapped_column(String(1000), nullable=False, default="")

    lines: Mapped[list[InvoiceLine]] = relationship(
        cascade="all, delete-orphan",
        order_by="InvoiceLine.created_at",
    )
    reminders: Mapped[list[InvoiceReminder]] = relationship(
        cascade="all, delete-orphan",
        order_by="InvoiceReminder.number",
    )


class InvoiceLine(UUIDBase):
    __tablename__ = "invoice_lines"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("articles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    description_snapshot: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    vat_rate_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)


class InvoiceReminder(UUIDBase):
    """A payment reminder sent for an overdue invoice: 1st, 2nd…"""

    __tablename__ = "invoice_reminders"
    __table_args__ = (UniqueConstraint("invoice_id", "number"),)

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    sent_on: Mapped[date] = mapped_column(Date, nullable=False)
    # The new deadline the reminder gives.
    due_on: Mapped[date] = mapped_column(Date, nullable=False)
