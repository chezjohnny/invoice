from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceStatus
from app.models.tenant import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class InvoiceKpi(BaseModel):
    count: int
    total: float


class RecentInvoiceItem(BaseModel):
    id: str
    invoice_number: str | None
    customer_name: str
    status: str
    issue_date: str | None
    total: float


class DashboardStats(BaseModel):
    draft: InvoiceKpi
    issued: InvoiceKpi
    paid: InvoiceKpi
    customer_count: int
    article_count: int
    recent_invoices: list[RecentInvoiceItem]


def _invoice_total(invoice: Invoice) -> float:
    sub = sum(int(line.quantity) * float(line.unit_price_snapshot) for line in invoice.lines)
    disc = sub * float(invoice.discount_percent) / 100
    vat = sum(
        int(line.quantity) * float(line.unit_price_snapshot)
        * (1 - float(invoice.discount_percent) / 100)
        * float(line.vat_rate_snapshot)
        for line in invoice.lines
        if line.vat_rate_snapshot is not None
    )
    return sub - disc + vat


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    invoices = list(
        (
            await db.execute(
                select(Invoice)
                .where(Invoice.tenant_id == current_user.tenant_id)
                .options(selectinload(Invoice.lines))
                .order_by(Invoice.created_at.desc())
            )
        ).scalars().all()
    )

    current_year = date.today().year
    draft = [i for i in invoices if i.status == InvoiceStatus.DRAFT]
    issued = [i for i in invoices if i.status == InvoiceStatus.ISSUED]
    paid = [
        i for i in invoices
        if i.status == InvoiceStatus.PAID
        and i.issue_date is not None
        and i.issue_date.year == current_year
    ]

    recent = invoices[:5]
    customer_ids = list({i.customer_id for i in recent})
    cust_rows = (
        await db.execute(
            select(Customer.id, Customer.first_name, Customer.last_name)
            .where(Customer.id.in_(customer_ids))
        )
    ).all() if customer_ids else []
    names = {str(r.id): f"{r.last_name}, {r.first_name}" for r in cust_rows}

    customer_count = (
        await db.scalar(
            select(func.count(Customer.id)).where(
                Customer.tenant_id == current_user.tenant_id,
                Customer.is_archived.is_(False),
            )
        )
    ) or 0

    article_count = (
        await db.scalar(
            select(func.count(Article.id)).where(
                Article.tenant_id == current_user.tenant_id,
                Article.is_archived.is_(False),
            )
        )
    ) or 0

    return DashboardStats(
        draft=InvoiceKpi(count=len(draft), total=sum(_invoice_total(i) for i in draft)),
        issued=InvoiceKpi(count=len(issued), total=sum(_invoice_total(i) for i in issued)),
        paid=InvoiceKpi(count=len(paid), total=sum(_invoice_total(i) for i in paid)),
        customer_count=customer_count,
        article_count=article_count,
        recent_invoices=[
            RecentInvoiceItem(
                id=str(i.id),
                invoice_number=i.invoice_number,
                customer_name=names.get(str(i.customer_id), ""),
                status=i.status.value,
                issue_date=i.issue_date.isoformat() if i.issue_date else None,
                total=_invoice_total(i),
            )
            for i in recent
        ],
    )
