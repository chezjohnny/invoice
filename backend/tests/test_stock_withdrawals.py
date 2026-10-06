import csv
import io

import pytest
from httpx import AsyncClient

ARTICLES = "/articles"
WITHDRAWALS = "/stock-withdrawals"

ARTICLE_PAYLOAD = {
    "name": "Pinot Noir",
    "description": "AOC Vaud",
    "unit_price": "28.00",
    "vat_rate_override": None,
    "stock_quantity": 10,
}


async def _article(client: AsyncClient, headers: dict[str, str], name: str = "Pinot Noir") -> str:
    resp = await client.post(ARTICLES, json={**ARTICLE_PAYLOAD, "name": name}, headers=headers)
    return str(resp.json()["id"])


async def _withdraw(
    client: AsyncClient,
    headers: dict[str, str],
    article_id: str,
    quantity: int,
    reason: str = "tasting",
    on: str = "2026-05-12",
) -> str:
    resp = await client.post(
        WITHDRAWALS,
        json={
            "article_id": article_id,
            "date": on,
            "quantity": quantity,
            "reason": reason,
            "note": "Salon des vins",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return str(resp.json()["id"])


async def _stock(client: AsyncClient, headers: dict[str, str], article_id: str) -> int:
    items = (await client.get(ARTICLES, headers=headers)).json()["items"]
    return int(next(a["stock_quantity"] for a in items if a["id"] == article_id))


@pytest.mark.anyio
async def test_withdrawal_takes_stock_and_delete_gives_it_back(
    client: AsyncClient, auth_headers: dict[str, str]
):
    article_id = await _article(client, auth_headers)

    withdrawal_id = await _withdraw(client, auth_headers, article_id, 3)
    assert await _stock(client, auth_headers, article_id) == 7

    data = (await client.get(WITHDRAWALS, headers=auth_headers)).json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item == {
        "id": withdrawal_id,
        "article_id": article_id,
        "article_name": "Pinot Noir",
        "date": "2026-05-12",
        "quantity": 3,
        "reason": "tasting",
        "note": "Salon des vins",
    }

    resp = await client.delete(f"{WITHDRAWALS}/{withdrawal_id}", headers=auth_headers)
    assert resp.status_code == 204
    assert await _stock(client, auth_headers, article_id) == 10
    assert (await client.get(WITHDRAWALS, headers=auth_headers)).json()["total"] == 0


@pytest.mark.anyio
async def test_withdrawal_validation(client: AsyncClient, auth_headers: dict[str, str]):
    article_id = await _article(client, auth_headers)
    payload = {"article_id": article_id, "date": "2026-05-12", "quantity": 1, "reason": "loss"}

    for invalid in ({"quantity": 0}, {"reason": "theft"}, {"note": "x" * 501}):
        resp = await client.post(WITHDRAWALS, json={**payload, **invalid}, headers=auth_headers)
        assert resp.status_code == 422, invalid
    assert await _stock(client, auth_headers, article_id) == 10


@pytest.mark.anyio
async def test_withdrawal_tenant_isolation(
    client: AsyncClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    article_id = await _article(client, auth_headers)
    withdrawal_id = await _withdraw(client, auth_headers, article_id, 2)
    other = other_headers

    assert (await client.get(WITHDRAWALS, headers=other)).json()["total"] == 0
    resp = await client.post(
        WITHDRAWALS,
        json={
            "article_id": article_id,
            "date": "2026-05-12",
            "quantity": 1,
            "reason": "loss",
        },
        headers=other,
    )
    assert resp.status_code == 404
    assert (await client.delete(f"{WITHDRAWALS}/{withdrawal_id}", headers=other)).status_code == 404
    assert await _stock(client, auth_headers, article_id) == 8


@pytest.mark.anyio
async def test_list_withdrawals_filters_and_sort(client: AsyncClient, auth_headers: dict[str, str]):
    pinot = await _article(client, auth_headers)
    chasselas = await _article(client, auth_headers, "Chasselas")
    await _withdraw(client, auth_headers, pinot, 1, "tasting", "2026-03-01")
    await _withdraw(client, auth_headers, chasselas, 6, "loss", "2026-04-01")
    await _withdraw(client, auth_headers, pinot, 2, "promotion", "2026-02-01")

    async def quantities(query: str = "") -> list[int]:
        data = (await client.get(f"{WITHDRAWALS}?{query}", headers=auth_headers)).json()
        return [int(i["quantity"]) for i in data["items"]]

    assert await quantities() == [6, 1, 2]  # most recent first
    assert await quantities("reason=loss") == [6]
    assert await quantities(f"article_id={pinot}") == [1, 2]
    assert await quantities("search=chass") == [6]
    assert await quantities("sort=quantity&order=asc") == [1, 2, 6]
    by_article = (
        await client.get(f"{WITHDRAWALS}?sort=article&order=desc", headers=auth_headers)
    ).json()
    assert [i["article_name"] for i in by_article["items"]] == [
        "Pinot Noir",
        "Pinot Noir",
        "Chasselas",
    ]


@pytest.mark.anyio
async def test_articles_report_withdrawn_quantity_by_period(
    client: AsyncClient, auth_headers: dict[str, str]
):
    article_id = await _article(client, auth_headers)
    await _withdraw(client, auth_headers, article_id, 1, on="2025-03-31")
    await _withdraw(client, auth_headers, article_id, 2, on="2025-04-01")
    await _withdraw(client, auth_headers, article_id, 4, on="2026-01-15")

    async def withdrawn(query: str = "") -> int:
        data = (await client.get(f"{ARTICLES}?{query}", headers=auth_headers)).json()
        return int(data["items"][0]["withdrawn_quantity"])

    assert await withdrawn() == 7
    assert await withdrawn("sales_year=2025") == 3
    assert await withdrawn("sales_year=2025&sales_quarter=2") == 2
    assert await withdrawn("sales_year=2026") == 4
    # Withdrawals are not sales.
    data = (await client.get(ARTICLES, headers=auth_headers)).json()
    assert data["items"][0]["sold_quantity"] == 0


@pytest.mark.anyio
async def test_export_articles_csv_for_the_period(
    client: AsyncClient, auth_headers: dict[str, str]
):
    pinot = await _article(client, auth_headers)
    chasselas = await _article(client, auth_headers, "Chasselas")
    await _withdraw(client, auth_headers, pinot, 2, on="2025-05-12")
    await _withdraw(client, auth_headers, pinot, 1, on="2025-11-02")
    await client.patch(f"{ARTICLES}/{chasselas}/archive", headers=auth_headers)

    resp = await client.get(
        f"{ARTICLES}/export.csv",
        params={"sales_year": 2025, "sales_quarter": 2},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "articles-2025-Q2.csv" in resp.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(resp.text)))
    assert rows[0] == [
        "name",
        "description",
        "unit_price",
        "vat_rate",
        "stock_quantity",
        "sold_quantity",
        "withdrawn_quantity",
    ]
    # Only the active articles, as listed by default.
    assert [(r[0], r[4], r[6]) for r in rows[1:]] == [("Pinot Noir", "7", "2")]

    all_time = await client.get(f"{ARTICLES}/export.csv", headers=auth_headers)
    assert 'filename="articles.csv"' in all_time.headers["content-disposition"]
    assert list(csv.reader(io.StringIO(all_time.text)))[1][6] == "3"

    archived = await client.get(f"{ARTICLES}/export.csv?archived=true", headers=auth_headers)
    assert 'filename="articles-archived.csv"' in archived.headers["content-disposition"]
    assert [r[0] for r in list(csv.reader(io.StringIO(archived.text)))[1:]] == ["Chasselas"]

    bad = await client.get(f"{ARTICLES}/export.csv?sales_quarter=1", headers=auth_headers)
    assert bad.status_code == 422


@pytest.mark.anyio
async def test_article_search_ignores_accents(client: AsyncClient, auth_headers: dict[str, str]):
    chateau = await _article(client, auth_headers, "Château Margaux")
    await _article(client, auth_headers, "Chasselas")
    await _withdraw(client, auth_headers, chateau, 1)

    found = (await client.get(ARTICLES, params={"search": "chateau"}, headers=auth_headers)).json()
    assert [a["name"] for a in found["items"]] == ["Château Margaux"]
    withdrawals = (
        await client.get(WITHDRAWALS, params={"search": "margaux chât"}, headers=auth_headers)
    ).json()
    assert withdrawals["total"] == 1
