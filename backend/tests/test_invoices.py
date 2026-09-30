import re
import zlib
from datetime import date, datetime
from types import SimpleNamespace
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice
from app.services.pdf import _build_qr_payload, _chf

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


def test_qr_payload_contains_all_fields_in_spec_order():
    payload = _build_qr_payload(
        invoice=SimpleNamespace(invoice_number="FAC-2026-0001"),
        profile=SimpleNamespace(
            iban="CH9300762011623852957",
            company_name="Cave Test",
            address_line1="Rue du Lac 1",
            postal_code="1110",
            city="Morges",
        ),
        customer=SimpleNamespace(
            first_name="Jean",
            last_name="Dupont",
            address_line1="Rue de la Gare 2",
            postal_code="1000",
            city="Lausanne",
        ),
        amount=108.10,
    )

    fields = payload.split("\r\n")

    assert len(fields) == 34
    assert fields[0:5] == ["SPC", "0200", "1", "CH9300762011623852957", "K"]
    assert fields[11:18] == [""] * 7
    assert fields[18:21] == ["108.10", "CHF", "K"]
    assert fields[21:27] == [
        "Jean Dupont", "Rue de la Gare 2", "1000 Lausanne", "", "", "CH"
    ]
    assert fields[27:34] == ["NON", "", "FAC-2026-0001", "EPD", "", "", ""]


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
async def test_invoice_history_newest_first(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    db_session: AsyncSession,
):
    older = await client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    newer = await client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(older.json()["id"]))
        .values(created_at=datetime(2020, 1, 1))
    )
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(newer.json()["id"]))
        .values(created_at=datetime(2025, 1, 1))
    )
    await db_session.commit()

    response = await client.get(
        f"{INVOICES}?customer_id={customer_id}", headers=auth_headers
    )

    assert [invoice["id"] for invoice in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


@pytest.mark.anyio
async def test_invoice_history_uses_issue_date_for_imported_invoices(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    db_session: AsyncSession,
):
    older = await client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    newer = await client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    import_created_at = datetime(2026, 9, 29, 17, 36, 42)
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(older.json()["id"]))
        .values(issue_date=date(2022, 1, 5), created_at=import_created_at)
    )
    await db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(newer.json()["id"]))
        .values(issue_date=date(2025, 11, 21), created_at=import_created_at)
    )
    await db_session.commit()

    response = await client.get(
        f"{INVOICES}?customer_id={customer_id}", headers=auth_headers
    )

    assert [invoice["id"] for invoice in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


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
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
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
async def test_issue_invoice_requires_complete_profile(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    invoice_id = create.json()["id"]
    resp = await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    assert resp.status_code == 422
    assert "incomplete" in resp.json()["detail"]

    listed = await client.get(INVOICES, headers=auth_headers)
    assert listed.json()["items"][0]["status"] == "draft"


@pytest.mark.anyio
async def test_pay_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = await client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    assert resp.json()["paid_at"] == date.today().isoformat()


@pytest.mark.anyio
async def test_update_payment_date(
    client: AsyncClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
):
    create = await client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    await client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)

    response = await client.patch(
        f"{INVOICES}/{invoice_id}/payment-date",
        json={"paid_at": "2025-03-12"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["paid_at"] == "2025-03-12"


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
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = await client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = await client.post(f"{INVOICES}/{invoice_id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_download_pdf(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
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


def _pdf_text(content: bytes) -> str:
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", content, re.DOTALL)
    return b"".join(zlib.decompress(s) for s in streams if s[:1] == b"x").decode("latin-1")


@pytest.mark.anyio
async def test_pdf_shows_twint_payment_only_when_configured(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    invoice_id = create.json()["id"]
    await client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    pdf_url = f"{INVOICES}/{invoice_id}/pdf"

    without = _pdf_text((await client.get(pdf_url, headers=auth_headers)).content)
    assert "TWINT" not in without

    profile = (await client.get("/tenant/profile", headers=auth_headers)).json()
    writable = {k: v for k, v in profile.items()
                if k not in ("id", "tenant_id", "invoice_next_number", "is_complete")}
    await client.put(
        "/tenant/profile", json={**writable, "twint_phone": "079 123 45 67"}, headers=auth_headers
    )
    text = _pdf_text((await client.get(pdf_url, headers=auth_headers)).content)
    assert "Pay with TWINT" in text
    assert "079 123 45 67" in text


@pytest.mark.anyio
async def test_pdf_language(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = await client.post(INVOICES, json={
        "customer_id": customer_id, "lines": [LINE],
    }, headers=auth_headers)
    pdf_url = f"{INVOICES}/{create.json()['id']}/pdf"

    english = _pdf_text((await client.get(pdf_url, headers=auth_headers)).content)
    assert "Invoice" in english and "Receipt" in english

    french = _pdf_text((await client.get(f"{pdf_url}?lang=fr", headers=auth_headers)).content)
    assert "Facture" in french and "Récépissé" in french
    assert "Invoice" not in french

    resp = await client.get(f"{pdf_url}?lang=de", headers=auth_headers)
    assert resp.status_code == 422


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


def test_chf_uses_swiss_thousands_separator():
    assert _chf(1234.5) == "1'234.50"
    assert _chf(-13.5) == "-13.50"
    assert _chf(1234567.891, " ") == "1 234 567.89"
