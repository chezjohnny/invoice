"""Invoice computations shared by the routes, the dashboard and the PDF."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select

from app.models.article import Article
from app.models.invoice import Invoice, InvoiceLine
from app.models.tenant import TenantProfile

CENT = Decimal("0.01")


def _cents(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class InvoiceAmounts:
    subtotal: Decimal
    discount: Decimal
    vat: dict[Decimal, Decimal]  # per rate, ascending
    total: Decimal


def invoice_amounts(invoice: Invoice) -> InvoiceAmounts:
    """What the PDF prints, the QR-bill asks for and the dashboard adds up: the
    discount and each rate's VAT (on the discounted lines) rounded once, to the
    cent. The frontend's invoiceAmounts() applies the same rule."""
    percent = Decimal(invoice.discount_percent)
    subtotal = sum(
        (line.quantity * Decimal(line.unit_price_snapshot) for line in invoice.lines), Decimal(0)
    )
    nets: dict[Decimal, Decimal] = {}
    for line in invoice.lines:
        if line.vat_rate_snapshot is not None:
            rate = Decimal(line.vat_rate_snapshot)
            nets[rate] = nets.get(rate, Decimal(0)) + line.quantity * Decimal(
                line.unit_price_snapshot
            )
    kept = 1 - percent / 100
    vat = {rate: _cents(net * kept * rate) for rate, net in sorted(nets.items())}
    discount = _cents(subtotal * percent / 100)
    return InvoiceAmounts(subtotal, discount, vat, subtotal - discount + sum(vat.values()))


def invoice_total(invoice: Invoice) -> Decimal:
    """The amount due."""
    return invoice_amounts(invoice).total


def effective_vat_rate(article: Article, profile: TenantProfile) -> Decimal | None:
    """The article's own VAT rate, else the tenant's default (None: not VAT-registered)."""
    if article.vat_rate_override is not None:
        return article.vat_rate_override
    return profile.default_vat_rate


def invoice_total_sql() -> Any:
    """invoice_total() in SQL, unrounded: close enough to sort by amount."""
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
