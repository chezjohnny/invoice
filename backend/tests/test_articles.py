from datetime import date, datetime
from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.invoice import Invoice
from tests.conftest import MakeInvoice

ARTICLES = "/articles"


ARTICLE_PAYLOAD = {
    "name": "Pinot Noir",
    "description": "AOC Vaud",
    "unit_price": "28.00",
    "vat_rate_override": None,
    "stock_quantity": 10,
}


@pytest.mark.anyio
async def test_create_article(client: AsyncClient, auth_headers: dict[str, str]):
    resp = await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Pinot Noir"
    assert data["is_archived"] is False
    assert "id" in data


@pytest.mark.anyio
async def test_list_articles(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    resp = await client.get(ARTICLES, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


@pytest.mark.anyio
async def test_list_articles_newest_first(
    client: AsyncClient, auth_headers: dict[str, str], db_session: AsyncSession
):
    older = await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    newer = await client.post(
        ARTICLES,
        json={**ARTICLE_PAYLOAD, "name": "Nouveau Pinot"},
        headers=auth_headers,
    )
    await db_session.execute(
        update(Article)
        .where(Article.id == UUID(older.json()["id"]))
        .values(created_at=datetime(2020, 1, 1))
    )
    await db_session.execute(
        update(Article)
        .where(Article.id == UUID(newer.json()["id"]))
        .values(created_at=datetime(2025, 1, 1))
    )
    await db_session.commit()

    response = await client.get(ARTICLES, headers=auth_headers)

    assert [article["id"] for article in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


@pytest.mark.anyio
async def test_update_article(client: AsyncClient, auth_headers: dict[str, str]):
    create = await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    resp = await client.put(
        f"{ARTICLES}/{article_id}",
        json={**ARTICLE_PAYLOAD, "name": "Chardonnay"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Chardonnay"


@pytest.mark.anyio
async def test_archive_article(client: AsyncClient, auth_headers: dict[str, str]):
    create = await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    await client.patch(f"{ARTICLES}/{article_id}/archive", headers=auth_headers)
    resp = await client.get(ARTICLES, headers=auth_headers)
    assert all(a["id"] != article_id for a in resp.json()["items"])


@pytest.mark.anyio
async def test_article_search(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    await client.post(
        ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chardonnay"}, headers=auth_headers
    )
    resp = await client.get(f"{ARTICLES}?search=pinot", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Pinot Noir"


@pytest.mark.anyio
async def test_article_tenant_isolation(
    client: AsyncClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    article_id = (await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)).json()[
        "id"
    ]

    resp = await client.get(ARTICLES, headers=other_headers)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []
    for method, path in [
        ("GET", ""),
        ("PUT", ""),
        ("PATCH", "/archive"),
        ("PATCH", "/restore"),
    ]:
        resp = await client.request(
            method,
            f"{ARTICLES}/{article_id}{path}",
            headers=other_headers,
            json=ARTICLE_PAYLOAD if method == "PUT" else None,
        )
        assert resp.status_code == 404, (method, path)


@pytest.mark.anyio
async def test_list_archived_and_restore_article(client: AsyncClient, auth_headers: dict[str, str]):
    create = await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    await client.patch(f"{ARTICLES}/{article_id}/archive", headers=auth_headers)

    archived = (await client.get(f"{ARTICLES}?archived=true", headers=auth_headers)).json()
    assert [x["id"] for x in archived["items"]] == [article_id]
    assert archived["total"] == 1

    resp = await client.patch(f"{ARTICLES}/{article_id}/restore", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False
    active = (await client.get(ARTICLES, headers=auth_headers)).json()
    assert [x["id"] for x in active["items"]] == [article_id]
    archived = (await client.get(f"{ARTICLES}?archived=true", headers=auth_headers)).json()
    assert archived["items"] == []


# The steps that bring an invoice to each status, from a draft.
STEPS = {
    "draft": (),
    "issued": ("issue",),
    "paid": ("issue", "pay"),
    "cancelled": ("issue", "cancel"),
}


async def _sell(make_invoice: MakeInvoice, article_id: str, quantity: int, status: str) -> str:
    invoice = await make_invoice(
        *STEPS[status],
        lines=[
            {
                "article_id": article_id,
                "description_snapshot": "Pinot Noir",
                "quantity": quantity,
                "unit_price_snapshot": "28.00",
                "vat_rate_snapshot": None,
            }
        ],
    )
    return str(invoice["id"])


@pytest.mark.anyio
async def test_sold_quantity_counts_issued_and_paid_invoices_only(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: AsyncSession,
    make_invoice: MakeInvoice,
):
    article_id = (await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)).json()[
        "id"
    ]
    unsold_id = (
        await client.post(
            ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chasselas"}, headers=auth_headers
        )
    ).json()["id"]
    this_year = date.today().year
    await _sell(make_invoice, article_id, 3, "issued")
    last_year = await _sell(make_invoice, article_id, 4, "paid")
    await _sell(make_invoice, article_id, 5, "draft")
    await _sell(make_invoice, article_id, 7, "cancelled")
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(last_year))
        .values(issue_date=date(this_year - 1, 6, 1))
    )
    await db_session.commit()

    def sold(data: dict[str, Any]) -> dict[str, int]:
        return {a["id"]: a["sold_quantity"] for a in data["items"]}

    all_time = (await client.get(ARTICLES, headers=auth_headers)).json()
    assert sold(all_time) == {article_id: 7, unsold_id: 0}
    previous = (
        await client.get(f"{ARTICLES}?sales_year={this_year - 1}", headers=auth_headers)
    ).json()
    assert sold(previous) == {article_id: 4, unsold_id: 0}
    current = (await client.get(f"{ARTICLES}?sales_year={this_year}", headers=auth_headers)).json()
    assert sold(current) == {article_id: 3, unsold_id: 0}

    years = (await client.get(f"{ARTICLES}/sales-years", headers=auth_headers)).json()
    assert years == [this_year, this_year - 1]


@pytest.mark.anyio
async def test_sold_quantity_by_quarter(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: AsyncSession,
    make_invoice: MakeInvoice,
):
    article_id = (await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)).json()[
        "id"
    ]
    # Quarter boundaries: 31 March is Q1, 1 April Q2, 31 December Q4.
    for quantity, issue_date in [
        (1, date(2025, 3, 31)),
        (2, date(2025, 4, 1)),
        (4, date(2025, 12, 31)),
    ]:
        invoice_id = await _sell(make_invoice, article_id, quantity, "issued")
        await db_session.execute(
            update(Invoice).where(Invoice.id == UUID(invoice_id)).values(issue_date=issue_date)
        )
    await db_session.commit()

    async def sold(query: str) -> int:
        resp = await client.get(f"{ARTICLES}?{query}", headers=auth_headers)
        return int(resp.json()["items"][0]["sold_quantity"])

    assert [await sold(f"sales_year=2025&sales_quarter={q}") for q in (1, 2, 3, 4)] == [1, 2, 0, 4]
    assert await sold("sales_year=2025") == 7

    resp = await client.get(f"{ARTICLES}?sales_quarter=1", headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_sort_articles(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    ids = {}
    for name, price, vat in [
        ("beta", "30.00", "0.026"),
        ("Alpha", "10.00", None),
        ("gamma", "20.00", "0.081"),
    ]:
        resp = await client.post(
            ARTICLES,
            json={
                **ARTICLE_PAYLOAD,
                "name": name,
                "unit_price": price,
                "vat_rate_override": vat,
            },
            headers=auth_headers,
        )
        ids[name] = resp.json()["id"]
    await _sell(make_invoice, ids["gamma"], 5, "issued")
    await _sell(make_invoice, ids["beta"], 2, "issued")

    async def names(query: str) -> list[str]:
        resp = await client.get(f"{ARTICLES}?{query}", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        return [a["name"] for a in resp.json()["items"]]

    # Case-insensitive, unlike SQLite's default binary collation.
    assert await names("sort=name") == ["Alpha", "beta", "gamma"]
    assert await names("sort=name&order=desc") == ["gamma", "beta", "Alpha"]
    assert await names("sort=unit_price&order=desc") == ["beta", "gamma", "Alpha"]
    assert await names("sort=sold_quantity&order=desc") == ["gamma", "beta", "Alpha"]
    # No override stays last in both directions.
    assert await names("sort=vat_rate_override") == ["beta", "gamma", "Alpha"]
    assert await names("sort=vat_rate_override&order=desc") == ["gamma", "beta", "Alpha"]

    assert (await client.get(f"{ARTICLES}?sort=tenant_id", headers=auth_headers)).status_code == 422


@pytest.mark.anyio
async def test_get_article(client: AsyncClient, auth_headers: dict[str, str]):
    article_id = (await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)).json()[
        "id"
    ]
    resp = await client.get(f"{ARTICLES}/{article_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Pinot Noir"
    other = "00000000-0000-0000-0000-000000000000"
    assert (await client.get(f"{ARTICLES}/{other}", headers=auth_headers)).status_code == 404
