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


CUSTOMER_PAYLOAD = {
    "first_name": "Jean",
    "last_name": "Dupont",
    "address_line1": "Rue de la Gare 12",
    "postal_code": "1110",
    "city": "Morges",
    "country": "CH",
    "email": "jean.dupont@example.ch",
    "phones": [{"label": "Mobile", "number": "+41 79 123 45 67"}],
}


@pytest.mark.anyio
async def test_create_customer(client: AsyncClient):
    headers = await _auth_header(client)
    resp = await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "Jean"
    assert data["last_name"] == "Dupont"
    assert data["phones"] == [{"label": "Mobile", "number": "+41 79 123 45 67"}]
    assert data["is_archived"] is False


@pytest.mark.anyio
async def test_list_customers(client: AsyncClient):
    headers = await _auth_header(client)
    await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    resp = await client.get("/customers", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.anyio
async def test_update_customer(client: AsyncClient):
    headers = await _auth_header(client)
    create = await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    customer_id = create.json()["id"]
    resp = await client.put(
        f"/customers/{customer_id}",
        json={**CUSTOMER_PAYLOAD, "first_name": "Jacques"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Jacques"


@pytest.mark.anyio
async def test_archive_customer(client: AsyncClient):
    headers = await _auth_header(client)
    create = await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    customer_id = create.json()["id"]
    await client.patch(f"/customers/{customer_id}/archive", headers=headers)
    resp = await client.get("/customers", headers=headers)
    assert all(c["id"] != customer_id for c in resp.json())


@pytest.mark.anyio
async def test_export_csv(client: AsyncClient):
    headers = await _auth_header(client)
    await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    resp = await client.get("/customers/export.csv", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().split("\n")
    assert lines[0].startswith("first_name")
    assert "Jean" in lines[1]


@pytest.mark.anyio
async def test_customer_tenant_isolation(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "A", "subdomain": "tenant-a", "email": "a@test.ch", "password": "secret",
    })
    resp_a = await client.post("/auth/login", json={"email": "a@test.ch", "password": "secret"})
    headers_a = {"Authorization": f"Bearer {resp_a.json()['access_token']}"}
    await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers_a)

    await client.post("/auth/register", json={
        "tenant_name": "B", "subdomain": "tenant-b", "email": "b@test.ch", "password": "secret",
    })
    resp_b = await client.post("/auth/login", json={"email": "b@test.ch", "password": "secret"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get("/customers", headers=headers_b)
    assert resp.json() == []
