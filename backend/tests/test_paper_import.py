import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.paper_import import import_paper_invoices, parse_paper_file


def _paper_file(customer_id: str) -> str:
    return f"""
# articles
db: Désir Blanc 75cl 2026, Martigny AOC Valais, prix: 15.0, quantité: 150
fl: Fendant Litre 100cl 2026 Martigny AOC Valais, prix: 12.5, quantité: 100

{customer_id}/202512205763
- db:12
- fl:24

{customer_id}/202512215764
- db:6
"""


@pytest.mark.anyio
async def test_import_paper_invoices_creates_paid_invoices_and_deducts_stock(
    db_session: AsyncSession,
    complete_profile: None,
    customer_id: str,
):
    counts = await import_paper_invoices(db_session, _paper_file(customer_id))

    assert counts == {
        "articles_created": 2,
        "articles_reused": 0,
        "invoices_created": 2,
        "invoices_skipped": 0,
    }
    invoice = await db_session.scalar(select(Invoice).where(Invoice.invoice_number == "FAC-20251220-5763"))
    assert invoice is not None
    assert invoice.status == InvoiceStatus.PAID
    assert invoice.customer_id == uuid.UUID(customer_id)
    assert invoice.issue_date == date(2025, 12, 20)
    assert invoice.paid_at == date(2025, 12, 20)
    assert invoice.due_date == date(2026, 1, 19)
    lines = (
        await db_session.scalars(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id))
    ).all()
    assert sorted((line.description_snapshot, line.quantity) for line in lines) == [
        ("Désir Blanc 75cl 2026, Martigny AOC Valais", 12),
        ("Fendant Litre 100cl 2026 Martigny AOC Valais", 24),
    ]
    assert {line.vat_rate_snapshot for line in lines} == {Decimal("0.0810")}
    desir = await db_session.scalar(
        select(Article).where(Article.name == "Désir Blanc 75cl 2026, Martigny AOC Valais")
    )
    assert desir is not None
    assert desir.unit_price == Decimal("15.00")
    assert desir.stock_quantity == 150 - 12 - 6


@pytest.mark.anyio
async def test_import_paper_invoices_rerun_skips_imported_invoices(
    db_session: AsyncSession,
    complete_profile: None,
    customer_id: str,
):
    text = _paper_file(customer_id)
    await import_paper_invoices(db_session, text)

    counts = await import_paper_invoices(db_session, text)

    assert counts == {
        "articles_created": 0,
        "articles_reused": 2,
        "invoices_created": 0,
        "invoices_skipped": 2,
    }
    fendant = await db_session.scalar(select(Article).where(Article.name.like("Fendant%")))
    assert fendant is not None
    assert fendant.stock_quantity == 100 - 24


@pytest.mark.anyio
async def test_import_paper_invoices_dry_run_writes_nothing(
    db_session: AsyncSession,
    complete_profile: None,
    customer_id: str,
):
    counts = await import_paper_invoices(db_session, _paper_file(customer_id), dry_run=True)

    assert counts["invoices_created"] == 2
    assert await db_session.scalar(select(func.count(Invoice.id))) == 0
    assert await db_session.scalar(select(func.count(Article.id))) == 0


@pytest.mark.anyio
async def test_import_paper_invoices_rejects_unknown_customer(db_session: AsyncSession):
    with pytest.raises(ValueError, match="Unknown customer id"):
        await import_paper_invoices(db_session, _paper_file(str(uuid.uuid4())))
    assert await db_session.scalar(select(func.count(Article.id))) == 0


CUSTOMER = "d0ba83c1-6f64-4a63-b110-5bc018bb106c"


@pytest.mark.parametrize(
    ("text", "error"),
    [
        (f"{CUSTOMER}/202512205763\n- xx:1", "line 2: unknown article alias 'xx'"),
        (f"{CUSTOMER}/202513205763\n- db:1", "line 1: .* does not start with a valid date"),
        (f"{CUSTOMER}/202512205763\n- db:0", "line 2: quantity must be positive"),
        (f"{CUSTOMER}/202512205763\n- db:-3", "line 2: unrecognized line"),
        (f"{CUSTOMER}/202512205763\n\n{CUSTOMER}/202512205763", "line 3: reference .* already used"),
        (f"{CUSTOMER}/202512205763", "line 1: invoice 202512205763 has no lines"),
        ("- db:1", "line 1: invoice line outside an invoice"),
        ("db: Autre, prix: 1, quantité: 1", "line 2: alias 'db' already defined"),
    ],
)
def test_parse_paper_file_reports_line_number(text: str, error: str):
    # Declared last: aliases may be used before their definition.
    with pytest.raises(ValueError, match=error):
        parse_paper_file(f"{text}\ndb: Désir Blanc, prix: 15.0, quantité: 150")
