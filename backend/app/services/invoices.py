"""Invoice computations shared by the routes, the dashboard and the PDF."""

from decimal import Decimal
from typing import Any

from sqlalchemy import func, select

from app.models.article import Article
from app.models.invoice import Invoice, InvoiceLine
from app.models.tenant import TenantProfile


def invoice_total(invoice: Invoice) -> float:
    """The amount due: the lines after discount, plus their VAT."""
    factor = 1 - float(invoice.discount_percent) / 100
    return sum(
        line.quantity
        * float(line.unit_price_snapshot)
        * factor
        * (1 + float(line.vat_rate_snapshot or 0))
        for line in invoice.lines
    )


def effective_vat_rate(article: Article, profile: TenantProfile) -> Decimal | None:
    """The article's own VAT rate, else the tenant's default (None: not VAT-registered)."""
    if article.vat_rate_override is not None:
        return article.vat_rate_override
    return profile.default_vat_rate


def invoice_total_sql() -> Any:
    """SQL mirror of invoice_total(), to sort by amount."""
    return (
        select(
            func.coalesce(
                func.sum(
                    InvoiceLine.quantity
                    * InvoiceLine.unit_price_snapshot
                    * (1 + func.coalesce(InvoiceLine.vat_rate_snapshot, 0))
                ),
                0,
            )
            * (1 - Invoice.discount_percent / 100)
        )
        .where(InvoiceLine.invoice_id == Invoice.id)
        .scalar_subquery()
    )


def recent_first() -> list[Any]:
    """The default order: the latest issued first, drafts by their creation day."""
    return [
        func.coalesce(Invoice.issue_date, func.date(Invoice.created_at)).desc(),
        Invoice.created_at.desc(),
        Invoice.id.desc(),
    ]
