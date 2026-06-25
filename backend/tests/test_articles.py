import pytest
from httpx import AsyncClient


async def _auth_header(client: AsyncClient) -> dict[str, str]:
    await client.post("/auth/register", json={
        "tenant_name": "Cave Test",
        "subdomain": "cave-test",
        "email": "cave@test.ch",
        "password": "secret123",
    })
    resp = await client.post("/auth/login", json={
        "email": "cave@test.ch",
        "password": "secret123",
    })
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


ARTICLE_PAYLOAD = {
    "name": "Pinot Noir",
    "description": "AOC Vaud",
    "unit_price": "28.00",
    "vat_rate_override": None,
    "stock_quantity": 10,
}


@pytest.mark.anyio
async def test_create_article(client: AsyncClient):
    headers = await _auth_header(client)
    resp = await client.post("/articles", json=ARTICLE_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Pinot Noir"
    assert data["is_archived"] is False
    assert "id" in data


@pytest.mark.anyio
async def test_list_articles(client: AsyncClient):
    headers = await _auth_header(client)
    await client.post("/articles", json=ARTICLE_PAYLOAD, headers=headers)
    resp = await client.get("/articles", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.anyio
async def test_update_article(client: AsyncClient):
    headers = await _auth_header(client)
    create = await client.post("/articles", json=ARTICLE_PAYLOAD, headers=headers)
    article_id = create.json()["id"]
    resp = await client.put(f"/articles/{article_id}", json={**ARTICLE_PAYLOAD, "name": "Chardonnay"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Chardonnay"


@pytest.mark.anyio
async def test_archive_article(client: AsyncClient):
    headers = await _auth_header(client)
    create = await client.post("/articles", json=ARTICLE_PAYLOAD, headers=headers)
    article_id = create.json()["id"]
    await client.patch(f"/articles/{article_id}/archive", headers=headers)
    resp = await client.get("/articles", headers=headers)
    assert all(a["id"] != article_id for a in resp.json())


@pytest.mark.anyio
async def test_article_tenant_isolation(client: AsyncClient):
    # tenant A creates an article
    await client.post("/auth/register", json={
        "tenant_name": "A", "subdomain": "tenant-a", "email": "a@test.ch", "password": "secret",
    })
    resp_a = await client.post("/auth/login", json={"email": "a@test.ch", "password": "secret"})
    headers_a = {"Authorization": f"Bearer {resp_a.json()['access_token']}"}
    await client.post("/articles", json=ARTICLE_PAYLOAD, headers=headers_a)

    # tenant B sees no articles
    await client.post("/auth/register", json={
        "tenant_name": "B", "subdomain": "tenant-b", "email": "b@test.ch", "password": "secret",
    })
    resp_b = await client.post("/auth/login", json={"email": "b@test.ch", "password": "secret"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get("/articles", headers=headers_b)
    assert resp.json() == []
