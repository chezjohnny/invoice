import uuid
from datetime import date

from pydantic import BaseModel

from app.models.invoice import InvoiceStatus


class InvoiceKpi(BaseModel):
    count: int
    total: float


class RecentInvoiceItem(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    customer_id: uuid.UUID
    customer_name: str
    status: InvoiceStatus
    issue_date: date | None
    total: float


class OverdueInvoiceItem(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    customer_id: uuid.UUID
    customer_name: str
    due_date: date
    total: float
    reminder_count: int
    # The latest reminder's date: whether one is due again.
    last_reminder_on: date | None


class DashboardStats(BaseModel):
    draft: InvoiceKpi
    issued: InvoiceKpi
    overdue: InvoiceKpi
    paid: InvoiceKpi
    invoice_count: int
    customer_count: int
    article_count: int
    recent_invoices: list[RecentInvoiceItem]
    overdue_invoices: list[OverdueInvoiceItem]
