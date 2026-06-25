import pytest
from httpx import AsyncClient

AUTH = "/auth"
CUSTOMERS = "/customers"
INVOICES = "/invoices"


LINE = {
    "article_id": None,
    "description_snapshot": "Service A",
    "quantity": 2,
    "unit_price_snapshot": "50.00",
    "vat_rate_snapshot": "0.081",
}


@pytest.mark.anyio
async def test_create_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    resp = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert len(data["lines"]) == 1
    assert data["invoice_number"] is None


@pytest.mark.anyio
async def test_list_invoices(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    resp = await client.get(INVOICES, headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


@pytest.mark.anyio
async def test_update_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    invoice_id = create.json()["id"]
    updated_line = {**LINE, "description_snapshot": "Updated service"}
    resp = await client.put(f"{INVOICES}/{invoice_id}", json={
        "customer_id": customer_id, "lines": [updated_line],
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["lines"][0]["description_snapshot"] == "Updated service"


@pytest.mark.anyio
async def test_issue_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    invoice_id = create.json()["id"]
    resp = await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "issued"
    assert data["invoice_number"] is not None
    assert data["issue_date"] is not None
    assert data["due_date"] is not None


@pytest.mark.anyio
async def test_pay_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = await client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"


@pytest.mark.anyio
async def test_cancel_draft(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    invoice_id = create.json()["id"]
    resp = await client.post(f"{INVOICES}/{invoice_id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_cancel_issued(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = await client.post(f"{INVOICES}/{invoice_id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_download_pdf(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = await client.get(f"{INVOICES}/{invoice_id}/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000


@pytest.mark.anyio
async def test_invoice_tenant_isolation(client: AsyncClient, auth_headers: dict[str, str]):
    cust_payload = {
        "first_name": "Jean", "last_name": "Dupont", "address_line1": "Rue 1",
        "postal_code": "1110", "city": "Morges", "country": "CH",
        "email": "jean@test.ch", "phones": [],
    }
    ca = await client.post(CUSTOMERS, json=cust_payload, headers=auth_headers)
    await client.post(INVOICES, json={"customer_id": ca.json()["id"], "lines": []}, headers=auth_headers)

    await client.post(f"{AUTH}/register", json={
        "tenant_name": "Other", "subdomain": "other-inv",
        "email": "other@inv.ch", "password": "secret",
    })
    resp_b = await client.post(f"{AUTH}/login", json={"email": "other@inv.ch", "password": "secret"})
    hb = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    resp = await client.get(INVOICES, headers=hb)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []
