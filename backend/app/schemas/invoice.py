import uuid
from datetime import date
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.invoice import InvoiceStatus, PaymentMethod


class InvoiceLineBase(BaseModel):
    article_id: uuid.UUID | None = None
    description_snapshot: str
    # Bounded: a negative amount makes an invalid QR-bill, a negative quantity
    # would put stock back on issue.
    quantity: int = Field(1, ge=1)
    unit_price_snapshot: Decimal = Field(ge=0)
    vat_rate_snapshot: Decimal | None = Field(None, ge=0, le=1)
    offered: bool = False

    @model_validator(mode="after")
    def _offered_article_for_nothing(self) -> Self:
        # Given away from the stock: an article, at no price, so no VAT row.
        if self.offered and (
            self.article_id is None
            or self.unit_price_snapshot != 0
            or self.vat_rate_snapshot is not None
        ):
            raise ValueError("An offered line is an article at 0, without VAT")
        return self


class InvoiceLineCreate(InvoiceLineBase):
    pass


class InvoiceLineResponse(InvoiceLineBase):
    id: uuid.UUID
    invoice_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    customer_id: uuid.UUID
    discount_percent: Decimal = Field(Decimal("0"), ge=0, le=100)
    notes: str = ""
    payment_method: PaymentMethod | None = None


class InvoiceCreate(InvoiceBase):
    lines: list[InvoiceLineCreate] = []


class InvoiceUpdate(InvoiceBase):
    lines: list[InvoiceLineCreate] = []


class InvoicePayment(BaseModel):
    """Optional details of a payment; without them it is paid today, as planned."""

    paid_at: date | None = None
    payment_method: PaymentMethod | None = None


class InvoicePaymentDateUpdate(BaseModel):
    paid_at: date


class InvoicePaymentMethodUpdate(BaseModel):
    payment_method: PaymentMethod


class InvoiceReminderResponse(BaseModel):
    number: int
    sent_on: date
    due_on: date

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(InvoiceBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_number: str | None
    status: InvoiceStatus
    issue_date: date | None
    due_date: date | None
    paid_at: date | None
    lines: list[InvoiceLineResponse]
    reminders: list[InvoiceReminderResponse] = []
    customer_name: str = ""

    model_config = ConfigDict(from_attributes=True)
