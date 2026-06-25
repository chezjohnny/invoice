import pytest
from httpx import AsyncClient

AUTH = "/auth"
CUSTOMERS = "/customers"


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
async def test_create_customer(client: AsyncClient, auth_headers: dict[str, str]):
    resp = await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "Jean"
    assert data["last_name"] == "Dupont"
    assert data["phones"] == [{"label": "Mobile", "number": "+41 79 123 45 67"}]
    assert data["is_archived"] is False


@pytest.mark.anyio
async def test_list_customers(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    resp = await client.get(CUSTOMERS, headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


@pytest.mark.anyio
async def test_update_customer(client: AsyncClient, auth_headers: dict[str, str]):
    create = await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    customer_id = create.json()["id"]
    resp = await client.put(
        f"{CUSTOMERS}/{customer_id}",
        json={**CUSTOMER_PAYLOAD, "first_name": "Jacques"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Jacques"


@pytest.mark.anyio
async def test_archive_customer(client: AsyncClient, auth_headers: dict[str, str]):
    create = await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    customer_id = create.json()["id"]
    await client.patch(f"{CUSTOMERS}/{customer_id}/archive", headers=auth_headers)
    resp = await client.get(CUSTOMERS, headers=auth_headers)
    assert all(c["id"] != customer_id for c in resp.json()["items"])


@pytest.mark.anyio
async def test_export_csv(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    resp = await client.get(f"{CUSTOMERS}/export.csv", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().split("\n")
    assert lines[0].startswith("first_name")
    assert "Jean" in lines[1]


@pytest.mark.anyio
async def test_customer_tenant_isolation(client: AsyncClient, auth_headers: dict[str, str]):
    await client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)

    await client.post(f"{AUTH}/register", json={
        "tenant_name": "Other", "subdomain": "other",
        "email": "other@test.ch", "password": "secret",
    })
    resp_b = await client.post(f"{AUTH}/login", json={"email": "other@test.ch", "password": "secret"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get(CUSTOMERS, headers=headers_b)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []
