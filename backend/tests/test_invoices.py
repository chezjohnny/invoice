import pytest
from httpx import AsyncClient


CUSTOMER_PAYLOAD = {
    "first_name": "Jean",
    "last_name": "Dupont",
    "address_line1": "Rue de la Gare 1",
    "postal_code": "1110",
    "city": "Morges",
    "country": "CH",
    "email": "jean@test.ch",
    "phones": [],
}

LINE = {
    "article_id": None,
    "description_snapshot": "Service A",
    "quantity": 2,
    "unit_price_snapshot": "50.00",
    "vat_rate_snapshot": "0.081",
}


async def _setup(client: AsyncClient) -> tuple[dict, str]:
    await client.post("/auth/register", json={
        "tenant_name": "Test Co", "subdomain": "test-inv",
        "email": "inv@test.ch", "password": "secret",
    })
    resp = await client.post("/auth/login", json={"email": "inv@test.ch", "password": "secret"})
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    cust = await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=headers)
    customer_id = cust.json()["id"]
    return headers, customer_id


@pytest.mark.anyio
async def test_create_invoice(client: AsyncClient):
    headers, customer_id = await _setup(client)
    resp = await client.post("/invoices", json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert len(data["lines"]) == 1
    assert data["invoice_number"] is None


@pytest.mark.anyio
async def test_list_invoices(client: AsyncClient):
    headers, customer_id = await _setup(client)
    await client.post("/invoices", json={"customer_id": customer_id, "lines": []}, headers=headers)
    resp = await client.get("/invoices", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.anyio
async def test_update_invoice(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=headers)
    invoice_id = create.json()["id"]
    updated_line = {**LINE, "description_snapshot": "Updated service"}
    resp = await client.put(f"/invoices/{invoice_id}", json={
        "customer_id": customer_id, "lines": [updated_line],
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["lines"][0]["description_snapshot"] == "Updated service"


@pytest.mark.anyio
async def test_issue_invoice(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=headers)
    invoice_id = create.json()["id"]
    resp = await client.post(f"/invoices/{invoice_id}/issue", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "issued"
    assert data["invoice_number"] is not None
    assert data["issue_date"] is not None
    assert data["due_date"] is not None


@pytest.mark.anyio
async def test_pay_invoice(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={"customer_id": customer_id, "lines": []}, headers=headers)
    invoice_id = create.json()["id"]
    await client.post(f"/invoices/{invoice_id}/issue", headers=headers)
    resp = await client.post(f"/invoices/{invoice_id}/pay", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


@pytest.mark.anyio
async def test_cancel_draft(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={"customer_id": customer_id, "lines": []}, headers=headers)
    invoice_id = create.json()["id"]
    resp = await client.post(f"/invoices/{invoice_id}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_cancel_issued(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={"customer_id": customer_id, "lines": []}, headers=headers)
    invoice_id = create.json()["id"]
    await client.post(f"/invoices/{invoice_id}/issue", headers=headers)
    resp = await client.post(f"/invoices/{invoice_id}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_download_pdf(client: AsyncClient):
    headers, customer_id = await _setup(client)
    create = await client.post("/invoices", json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=headers)
    invoice_id = create.json()["id"]
    await client.post(f"/invoices/{invoice_id}/issue", headers=headers)
    resp = await client.get(f"/invoices/{invoice_id}/pdf", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000


@pytest.mark.anyio
async def test_invoice_tenant_isolation(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "A", "subdomain": "inv-a", "email": "a@inv.ch", "password": "s",
    })
    resp_a = await client.post("/auth/login", json={"email": "a@inv.ch", "password": "s"})
    ha = {"Authorization": f"Bearer {resp_a.json()['access_token']}"}
    ca = await client.post("/customers", json=CUSTOMER_PAYLOAD, headers=ha)
    await client.post("/invoices", json={"customer_id": ca.json()["id"], "lines": []}, headers=ha)

    await client.post("/auth/register", json={
        "tenant_name": "B", "subdomain": "inv-b", "email": "b@inv.ch", "password": "s",
    })
    resp_b = await client.post("/auth/login", json={"email": "b@inv.ch", "password": "s"})
    hb = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get("/invoices", headers=hb)
    assert resp.json() == []
