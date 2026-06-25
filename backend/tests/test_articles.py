import pytest
from httpx import AsyncClient

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
