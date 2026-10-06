import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.invoice import InvoiceStatus, PaymentMethod


class InvoiceLineBase(BaseModel):
    article_id: uuid.UUID | None = None
    description_snapshot: str
    quantity: int = 1
    unit_price_snapshot: Decimal
    vat_rate_snapshot: Decimal | None = None


class InvoiceLineCreate(InvoiceLineBase):
    pass


class InvoiceLineResponse(InvoiceLineBase):
    id: uuid.UUID
    invoice_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class InvoiceBase(BaseModel):
    customer_id: uuid.UUID
    discount_percent: Decimal = Decimal("0")
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
