from collections.abc import Sequence
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceStatus
from app.models.tenant import User
from app.schemas.dashboard import (
    DashboardStats,
    InvoiceKpi,
    OverdueInvoiceItem,
    RecentInvoiceItem,
)
from app.services.customers import customer_names
from app.services.invoices import invoice_total, recent_first

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_INVOICES = 10


def _kpi(invoices: Sequence[Invoice]) -> InvoiceKpi:
    return InvoiceKpi(count=len(invoices), total=sum(invoice_total(i) for i in invoices))


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    tenant_id = current_user.tenant_id
    invoices = list(
        await db.scalars(
            select(Invoice)
            .where(Invoice.tenant_id == tenant_id)
            .options(selectinload(Invoice.lines), selectinload(Invoice.reminders))
            .order_by(*recent_first())
        )
    )

    today = date.today()
    draft = [i for i in invoices if i.status == InvoiceStatus.DRAFT]
    issued = [i for i in invoices if i.status == InvoiceStatus.ISSUED]
    # Still payable on the due date itself: overdue starts the day after.
    overdue = sorted(
        (i for i in issued if i.due_date is not None and i.due_date < today),
        key=lambda i: i.due_date or today,
    )
    # Cashed this year, whenever the invoice was issued.
    paid = [
        i
        for i in invoices
        if i.status == InvoiceStatus.PAID and i.paid_at is not None and i.paid_at.year == today.year
    ]
    recent = invoices[:RECENT_INVOICES]
    names = await customer_names(db, (i.customer_id for i in [*recent, *overdue]))

    customer_count = await db.scalar(
        select(func.count(Customer.id)).where(
            Customer.tenant_id == tenant_id, Customer.is_archived.is_(False)
        )
    )
    article_count = await db.scalar(
        select(func.count(Article.id)).where(
            Article.tenant_id == tenant_id, Article.is_archived.is_(False)
        )
    )

    return DashboardStats(
        draft=_kpi(draft),
        issued=_kpi(issued),
        overdue=_kpi(overdue),
        paid=_kpi(paid),
        invoice_count=len(invoices),
        customer_count=customer_count or 0,
        article_count=article_count or 0,
        recent_invoices=[
            RecentInvoiceItem(
                id=i.id,
                invoice_number=i.invoice_number,
                customer_id=i.customer_id,
                customer_name=names.get(i.customer_id, ""),
                status=i.status,
                issue_date=i.issue_date,
                total=invoice_total(i),
            )
            for i in recent
        ],
        overdue_invoices=[
            OverdueInvoiceItem(
                id=i.id,
                invoice_number=i.invoice_number,
                customer_id=i.customer_id,
                customer_name=names.get(i.customer_id, ""),
                due_date=i.due_date or today,
                total=invoice_total(i),
                reminder_count=len(i.reminders),
                last_reminder_on=i.reminders[-1].sent_on if i.reminders else None,
            )
            for i in overdue
        ],
    )
