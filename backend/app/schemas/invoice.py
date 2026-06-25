import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.invoice import InvoiceStatus


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


class InvoiceCreate(InvoiceBase):
    lines: list[InvoiceLineCreate] = []


class InvoiceUpdate(InvoiceBase):
    lines: list[InvoiceLineCreate] = []


class InvoiceResponse(InvoiceBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    invoice_number: str | None
    status: InvoiceStatus
    issue_date: date | None
    due_date: date | None
    pdf_url: str | None
    lines: list[InvoiceLineResponse]
    customer_name: str = ""

    model_config = ConfigDict(from_attributes=True)
