from datetime import date, datetime
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.invoice import Invoice

AUTH = "/auth"
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
    await client.post(ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chardonnay"}, headers=auth_headers)
    resp = await client.get(f"{ARTICLES}?search=pinot", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Pinot Noir"


@pytest.mark.anyio
async def test_article_tenant_isolation(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)

    await client.post(f"{AUTH}/register", json={
        "tenant_name": "Other", "subdomain": "other",
        "email": "other@test.ch", "password": "secret",
    })
    resp_b = await client.post(f"{AUTH}/login", json={"email": "other@test.ch", "password": "secret"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get(ARTICLES, headers=headers_b)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []


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


async def _invoice(
    client: AsyncClient, headers: dict[str, str], customer_id: str, article_id: str,
    quantity: int, action: str | None = None,
) -> str:
    resp = await client.post("/invoices", json={
        "customer_id": customer_id,
        "lines": [{
            "article_id": article_id, "description_snapshot": "Pinot Noir",
            "quantity": quantity, "unit_price_snapshot": "28.00", "vat_rate_snapshot": None,
        }],
    }, headers=headers)
    invoice_id = str(resp.json()["id"])
    for step in {"issue": ["issue"], "pay": ["issue", "pay"], "cancel": ["issue", "cancel"]}.get(
        action or "", []
    ):
        assert (await client.post(f"/invoices/{invoice_id}/{step}", headers=headers)).status_code == 200
    return invoice_id


@pytest.mark.anyio
async def test_sold_quantity_counts_issued_and_paid_invoices_only(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str,
    complete_profile: None, db_session: AsyncSession,
):
    article_id = (await client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)).json()["id"]
    unsold_id = (await client.post(
        ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chasselas"}, headers=auth_headers
    )).json()["id"]
    await _invoice(client, auth_headers, customer_id, article_id, 3, "issue")
    last_year = await _invoice(client, auth_headers, customer_id, article_id, 4, "pay")
    await _invoice(client, auth_headers, customer_id, article_id, 5)            # draft
    await _invoice(client, auth_headers, customer_id, article_id, 7, "cancel")
    await db_session.execute(
        update(Invoice).where(Invoice.id == UUID(last_year)).values(issue_date=date(2025, 6, 1))
    )
    await db_session.commit()
    this_year = date.today().year

    def sold(data: dict) -> dict[str, int]:
        return {a["id"]: a["sold_quantity"] for a in data["items"]}

    all_time = (await client.get(ARTICLES, headers=auth_headers)).json()
    assert sold(all_time) == {article_id: 7, unsold_id: 0}
    in_2025 = (await client.get(f"{ARTICLES}?sales_year=2025", headers=auth_headers)).json()
    assert sold(in_2025) == {article_id: 4, unsold_id: 0}
    current = (await client.get(f"{ARTICLES}?sales_year={this_year}", headers=auth_headers)).json()
    assert sold(current) == {article_id: 3, unsold_id: 0}

    years = (await client.get(f"{ARTICLES}/sales-years", headers=auth_headers)).json()
    assert years == sorted({this_year, 2025}, reverse=True)
