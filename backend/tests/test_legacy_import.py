import json
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.legacy_import import _legacy_paid_date, import_legacy_data
from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.tenant import Tenant


def test_legacy_paid_date_prefers_modification_then_creation_date():
    issue_date = date(2022, 1, 5)
    assert _legacy_paid_date(
        {"updated_at": "2025-03-12T10:30:00", "created_at": "2022-01-05T00:00:00"},
        issue_date,
    ) == date(2025, 3, 12)
    assert _legacy_paid_date({"created_at": "2023-06-20T12:00:00"}, issue_date) == date(2023, 6, 20)
    assert _legacy_paid_date({}, issue_date) == issue_date


@pytest.mark.anyio
async def test_import_legacy_uses_billed_name_when_source_ids_collide(
    db_session: AsyncSession,
    auth_headers: dict[str, str],
    tmp_path,
):
    customers_path = tmp_path / "customers.json"
    products_path = tmp_path / "products.json"
    invoices_path = tmp_path / "factures.json"
    customers_path.write_text(
        json.dumps([
            {"legacy_id": "rg", "name": "Rossier Marlène", "address_line1": "Rue A"},
            {"legacy_id": "rg", "name": "Rossier Gérald", "address_line1": "Le Rosex"},
        ]),
        encoding="utf-8",
    )
    products_path.write_text(
        json.dumps([
            {"reference": "nd-75", "name": "Noir Désir 2020", "price": 15.5, "stock": 20},
            {"reference": "nd-75", "name": "Noir Désir 2021", "price": 16.5, "stock": 30},
        ]),
        encoding="utf-8",
    )
    invoices_path.write_text(
        json.dumps([
            {
                "date": "2007-01-05",
                "echeance": "2007-02-05",
                "ref": "2007020201",
                "idClient": "rg",
                "client": "ROSSIER GÉRALD\nLe Rosex\n1920 Martigny-Croix",
                "tva": 7.6,
                "achats": [
                    {
                        "ref": "ND-75",
                        "desc": "Noir Désir 2021",
                        "quantite": 12,
                        "puht": 16.5,
                        "remise": 0,
                    }
                ],
            }
        ]),
        encoding="utf-8",
    )
    tenant = await db_session.scalar(select(Tenant).where(Tenant.subdomain == "cave-test"))
    assert tenant is not None

    counts = await import_legacy_data(
        db_session, "cave-test", customers_path, products_path, invoices_path
    )

    invoice = await db_session.scalar(select(Invoice).where(Invoice.invoice_number == "2007020201"))
    assert invoice is not None
    assert invoice.status.value == "paid"
    assert invoice.paid_at.isoformat() == "2007-01-05"
    billed_customer = await db_session.get(Customer, invoice.customer_id)
    assert billed_customer is not None
    assert billed_customer.first_name == "Gérald"
    assert billed_customer.last_name == "Rossier"
    line = await db_session.scalar(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id))
    assert line is not None
    assert line.article_id is not None
    assert line.unit_price_snapshot == Decimal("16.50")
    assert line.vat_rate_snapshot == Decimal("0.0760")
    article = await db_session.get(Article, line.article_id)
    assert article is not None
    assert article.name == "Noir Désir 2021"
    assert article.stock_quantity == 30
    assert counts == {
        "customers": 2,
        "articles": 2,
        "invoices": 1,
        "unmatched_invoice_customers": 0,
    }

    with pytest.raises(ValueError, match="requires an empty tenant"):
        await import_legacy_data(
            db_session, "cave-test", customers_path, products_path, invoices_path
        )