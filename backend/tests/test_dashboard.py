from datetime import date, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from tests.conftest import MakeInvoice

STATS = "/dashboard/stats"


def _line(unit_price: str) -> list[dict[str, object]]:
    return [
        {
            "article_id": None,
            "description_snapshot": "Pinot Noir",
            "quantity": 1,
            "unit_price_snapshot": unit_price,
            "vat_rate_snapshot": None,
        }
    ]


@pytest.mark.anyio
async def test_overdue_invoices(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: AsyncSession,
    make_invoice: MakeInvoice,
):
    today = date.today()
    due_dates = {
        (await make_invoice("issue", lines=_line("10.00")))["id"]: today - timedelta(days=1),
        (await make_invoice("issue", lines=_line("20.00")))["id"]: today - timedelta(days=40),
        # Due today: still on time.
        (await make_invoice("issue", lines=_line("40.00")))["id"]: today,
        # Paid or cancelled after the due date: no longer overdue.
        (await make_invoice("issue", "pay", lines=_line("80.00")))["id"]: today - timedelta(days=5),
        (await make_invoice("issue", "cancel", lines=_line("160.00")))["id"]: today
        - timedelta(days=5),
    }
    for invoice_id, due_date in due_dates.items():
        await db_session.execute(
            update(Invoice).where(Invoice.id == UUID(invoice_id)).values(due_date=due_date)
        )
    await db_session.commit()
    oldest, recent = list(due_dates)[1], list(due_dates)[0]

    stats = (await client.get(STATS, headers=auth_headers)).json()

    assert stats["overdue"] == {"count": 2, "total": 30.0}
    assert [i["id"] for i in stats["overdue_invoices"]] == [oldest, recent]
    first = stats["overdue_invoices"][0]
    assert first["customer_id"] == customer_id
    assert first["customer_name"] == "Dupont, Jean"
    assert first["due_date"] == (today - timedelta(days=40)).isoformat()
    assert first["total"] == 20.0


@pytest.mark.anyio
async def test_paid_this_year_counts_by_payment_date(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: AsyncSession,
    make_invoice: MakeInvoice,
):
    today = date.today()
    issued_last_year = (await make_invoice("issue", "pay", lines=_line("10.00")))["id"]
    paid_last_year = (await make_invoice("issue", "pay", lines=_line("20.00")))["id"]
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(issued_last_year))
        .values(issue_date=date(today.year - 1, 12, 20))
    )
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(paid_last_year))
        .values(paid_at=date(today.year - 1, 12, 31))
    )
    await db_session.commit()

    stats = (await client.get(STATS, headers=auth_headers)).json()
    # Issued last year but cashed this year: counted; cashed last year: not.
    assert stats["paid"] == {"count": 1, "total": 10.0}


@pytest.mark.anyio
async def test_dashboard_kpis(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    article_id: str,
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    # 100.00, 10 % off, then 8.1 % VAT: 97.29.
    taxed = [
        {
            "article_id": None,
            "description_snapshot": "Pinot Noir",
            "quantity": 2,
            "unit_price_snapshot": "50.00",
            "vat_rate_snapshot": "0.081",
        }
    ]
    await make_invoice(lines=taxed, discount_percent="10")
    await make_invoice("issue", lines=_line("20.00"))
    await make_invoice("issue", lines=_line("30.00"))
    paid = await make_invoice("issue", "pay", lines=_line("40.00"))
    await make_invoice("issue", "cancel", lines=_line("80.00"))
    archived = (
        await client.post(
            "/customers",
            json={
                "first_name": "Old",
                "last_name": "Client",
                "address_line1": "",
                "postal_code": "",
                "city": "",
                "country": "CH",
                "email": None,
                "phones": [],
            },
            headers=auth_headers,
        )
    ).json()["id"]
    await client.patch(f"/customers/{archived}/archive", headers=auth_headers)
    await client.patch(f"/articles/{article_id}/archive", headers=auth_headers)

    stats = (await client.get(STATS, headers=auth_headers)).json()

    assert stats["draft"] == {"count": 1, "total": pytest.approx(97.29)}
    assert stats["issued"] == {"count": 2, "total": 50.0}
    assert stats["paid"] == {"count": 1, "total": 40.0}
    assert stats["invoice_count"] == 5
    assert stats["customer_count"] == 1  # the archived customer is left out
    assert stats["article_count"] == 0
    recent = stats["recent_invoices"]
    assert len(recent) == 5
    assert recent[0]["customer_name"] == "Dupont, Jean"
    assert recent[0]["customer_id"] == customer_id
    assert paid["id"] in [r["id"] for r in recent]


@pytest.mark.anyio
async def test_recent_invoices_keep_the_ten_latest(
    client: AsyncClient,
    auth_headers: dict[str, str],
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    ids = {(await make_invoice())["id"] for _ in range(12)}
    recent = (await client.get(STATS, headers=auth_headers)).json()["recent_invoices"]
    # Created within the same second here, so only the limit is checked, not the order.
    assert len(recent) == 10
    assert {r["id"] for r in recent} <= ids
