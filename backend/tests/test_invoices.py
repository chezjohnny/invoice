import re
import zlib
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from qrbill import QRBill
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine
from app.models.tenant import TenantProfile
from app.services.customers import full_name
from app.services.invoices import invoice_amounts
from app.services.pdf import _build_qr_payload, _chf, _party_lines, _street_and_number
from tests.conftest import MakeInvoice

CUSTOMERS = "/customers"
INVOICES = "/invoices"


LINE = {
    "article_id": None,
    "description_snapshot": "Service A",
    "quantity": 2,
    "unit_price_snapshot": "50.00",
    "vat_rate_snapshot": "0.081",
}


def _invoice(discount: str, *lines: tuple[int, str, str | None]) -> Invoice:
    return Invoice(
        discount_percent=Decimal(discount),
        lines=[
            InvoiceLine(
                quantity=quantity,
                unit_price_snapshot=Decimal(price),
                vat_rate_snapshot=Decimal(rate) if rate else None,
            )
            for quantity, price, rate in lines
        ],
    )


def test_amounts_round_each_rate_once_to_the_cent():
    # 5.00 + 8.1 % is 5.405: one rounding, half up, for the PDF and the QR-bill alike.
    amounts = invoice_amounts(_invoice("0", (1, "5.00", "0.081")))
    assert amounts.vat == {Decimal("0.081"): Decimal("0.41")}
    assert amounts.total == Decimal("5.41")


def test_amounts_take_the_vat_on_the_discounted_lines():
    amounts = invoice_amounts(
        _invoice("10", (2, "50.00", "0.081"), (1, "100.00", None), (3, "9.90", "0.026"))
    )
    assert amounts.subtotal == Decimal("229.70")
    assert amounts.discount == Decimal("22.97")
    # 100 × 0.9 × 8.1 % = 7.29; 29.70 × 0.9 × 2.6 % = 0.69498
    assert amounts.vat == {Decimal("0.026"): Decimal("0.69"), Decimal("0.081"): Decimal("7.29")}
    assert amounts.total == Decimal("214.71")


def test_qr_payload_contains_all_fields_in_spec_order():
    payload = _build_qr_payload(
        invoice=Invoice(invoice_number="2610051"),
        profile=TenantProfile(
            iban="CH9300762011623852957",
            company_name="Cave Test",
            address_line1="Rue du Lac 1",
            address_line2="Case postale 3",
            postal_code="1110",
            city="Morges",
            country="CH",
        ),
        customer=Customer(
            first_name="Jean",
            last_name="Dupont",
            address_line1="Rue de la Gare 2",
            address_line2="Case postale 12",
            postal_code="9490",
            city="Vaduz",
            country="LI",
        ),
        amount=Decimal("108.10"),
    )

    fields = payload.split("\r\n")

    # Structured ("S") addresses only, since November 2025: no complement line.
    assert len(fields) == 31
    assert fields[0:5] == ["SPC", "0200", "1", "CH9300762011623852957", "S"]
    assert fields[5:11] == ["Cave Test", "Rue du Lac", "1", "1110", "Morges", "CH"]
    assert fields[11:18] == [""] * 7
    assert fields[18:21] == ["108.10", "CHF", "S"]
    assert fields[21:27] == ["Jean Dupont", "Rue de la Gare", "2", "9490", "Vaduz", "LI"]
    assert fields[27:31] == ["NON", "", "2610051", "EPD"]


def _qrbill_party(name: str, line1: str, postal_code: str, city: str, country: str):
    street, number = _street_and_number(line1)
    return {
        "name": name,
        "street": street,
        "house_num": number,
        "pcode": postal_code,
        "city": city,
        "country": country,
    }


@pytest.mark.parametrize(
    "customer",
    [
        {"last_name": "Ascenseurs Favre SA", "address_line1": "Rte de la Forêt 13"},
        {"first_name": "Paul", "last_name": "Morel", "address_line1": "Les Moulins"},
        {"last_name": "Société de Chant Ste-Thérèse", "address_line1": "Chemin des Vignes 4 A"},
        {"first_name": "Jean", "last_name": "Dupont", "address_line1": "13, rue du Lac"},
        {
            "first_name": "Jean",
            "last_name": "Dupont",
            "address_line1": "Rue de la Gare 2",
            "postal_code": "9490",
            "city": "Vaduz",
            "country": "LI",
        },
        {"last_name": "Lunabar", "address_line1": "", "postal_code": "", "city": ""},
    ],
)
def test_qr_payload_matches_the_qrbill_reference(customer: dict[str, str]):
    """qrbill, an independent implementation of the SIX guidelines, as an oracle."""
    profile = TenantProfile(
        iban="CH9300762011623852957",
        company_name="Cave Test",
        address_line1="Route du Vignoble 4",
        postal_code="1932",
        city="Bovernier",
        country="CH",
    )
    debtor = Customer(
        **{"first_name": "", "postal_code": "1004", "city": "Lausanne", "country": "CH"} | customer
    )
    ours = _build_qr_payload(Invoice(invoice_number="2610051"), profile, debtor, Decimal("1234.50"))

    reference = QRBill(
        account=profile.iban,
        creditor=_qrbill_party(
            profile.company_name, profile.address_line1, profile.postal_code, profile.city, "CH"
        ),
        debtor=_qrbill_party(
            full_name(debtor),
            debtor.address_line1,
            debtor.postal_code,
            debtor.city,
            debtor.country,
        )
        if debtor.postal_code
        else None,
        amount="1234.50",
        additional_information="2610051",
    )
    assert ours == reference.qr_data()


def test_qr_payload_leaves_out_a_debtor_without_postal_code():
    payload = _build_qr_payload(
        invoice=Invoice(invoice_number="2610051"),
        profile=TenantProfile(
            iban="CH9300762011623852957",
            company_name="Cave Test",
            address_line1="Rue du Lac 1",
            postal_code="1110",
            city="Morges",
            country="CH",
        ),
        customer=Customer(
            first_name="", last_name="Lunabar", address_line1="", postal_code="", city=""
        ),
        amount=Decimal("10.00"),
    )
    assert payload.split("\r\n")[20:27] == [""] * 7


def test_street_and_number_are_split_for_the_structured_address():
    assert _street_and_number("Rte de la Forêt 13") == ("Rte de la Forêt", "13")
    assert _street_and_number("Rue du Lac 2bis") == ("Rue du Lac", "2bis")
    assert _street_and_number("Chemin des Vignes 4 A") == ("Chemin des Vignes", "4 A")
    assert _street_and_number("Avenue de la Gare 12-14") == ("Avenue de la Gare", "12-14")
    assert _street_and_number("13, rue du Lac") == ("rue du Lac", "13")
    assert _street_and_number("Rue du 1er Mars 5") == ("Rue du 1er Mars", "5")
    assert _street_and_number("Les Moulins") == ("Les Moulins", "")


def test_address_puts_a_contact_above_the_street_and_a_po_box_below():
    contact = _party_lines("Garage SA", "Rue du Lac 1", "Par Mme Dupuis", "1932", "Bovernier")
    assert contact == ["Garage SA", "Par Mme Dupuis", "Rue du Lac 1", "1932 Bovernier"]
    po_box = _party_lines("Garage SA", "Rue du Lac 1", "Case postale 12", "1932", "Bovernier")
    assert po_box == ["Garage SA", "Rue du Lac 1", "Case postale 12", "1932 Bovernier"]
    assert _party_lines("Garage SA", "Rue du Lac 1", None, "", "") == ["Garage SA", "Rue du Lac 1"]


@pytest.mark.parametrize(
    "change",
    [
        {"lines": [LINE | {"quantity": 0}]},
        {"lines": [LINE | {"quantity": -2}]},
        {"lines": [LINE | {"unit_price_snapshot": "-1.00"}]},
        {"lines": [LINE | {"vat_rate_snapshot": "1.5"}]},
        {"discount_percent": "150"},
        {"discount_percent": "-5"},
    ],
)
def test_invoice_amounts_are_bounded(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, change: dict[str, Any]
):
    payload = {"customer_id": customer_id, "lines": [LINE]} | change
    resp = client.post(INVOICES, json=payload, headers=auth_headers)
    assert resp.status_code == 422


def test_create_invoice(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    resp = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert len(data["lines"]) == 1
    assert data["invoice_number"] is None
    assert data["payment_method"] is None


def test_get_invoice(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    invoice_id = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    ).json()["id"]

    resp = client.get(f"{INVOICES}/{invoice_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == invoice_id
    assert len(resp.json()["lines"]) == 1

    other = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"{INVOICES}/{other}", headers=auth_headers).status_code == 404


def test_invoice_payment_method(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    resp = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
            "payment_method": "twint",
        },
        headers=auth_headers,
    )
    assert resp.json()["payment_method"] == "twint"

    resp = client.put(
        f"{INVOICES}/{resp.json()['id']}",
        json={
            "customer_id": customer_id,
            "lines": [LINE],
            "payment_method": "iban",
        },
        headers=auth_headers,
    )
    assert resp.json()["payment_method"] == "iban"

    resp = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
            "payment_method": "card",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_list_invoices(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    client.post(INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    resp = client.get(INVOICES, headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


def test_invoice_history_newest_first(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    db_session: Session,
):
    older = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    newer = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(older.json()["id"]))
        .values(created_at=datetime(2020, 1, 1))
    )
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(newer.json()["id"]))
        .values(created_at=datetime(2025, 1, 1))
    )
    db_session.commit()

    response = client.get(f"{INVOICES}?customer_id={customer_id}", headers=auth_headers)

    assert [invoice["id"] for invoice in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


def test_history_orders_by_issue_date_before_creation(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    db_session: Session,
):
    older = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    newer = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    # Created together (as imported invoices were): the issue date decides.
    created_at = datetime(2026, 9, 29, 17, 36, 42)
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(older.json()["id"]))
        .values(issue_date=date(2022, 1, 5), created_at=created_at)
    )
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(newer.json()["id"]))
        .values(issue_date=date(2025, 11, 21), created_at=created_at)
    )
    db_session.commit()

    response = client.get(f"{INVOICES}?customer_id={customer_id}", headers=auth_headers)

    assert [invoice["id"] for invoice in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


def test_update_invoice(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    updated_line = {**LINE, "description_snapshot": "Updated service"}
    resp = client.put(
        f"{INVOICES}/{invoice_id}",
        json={
            "customer_id": customer_id,
            "lines": [updated_line],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["lines"][0]["description_snapshot"] == "Updated service"


def test_search_matches_number_line_or_customer_words(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    fendant = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [{**LINE, "description_snapshot": "Noir Désir Martigny 75cl 2024"}],
        },
        headers=auth_headers,
    )
    other = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    issued = client.post(f"{INVOICES}/{other.json()['id']}/issue", headers=auth_headers)

    def found(search: str) -> list[str]:
        resp = client.get(INVOICES, params={"search": search}, headers=auth_headers)
        return [i["id"] for i in resp.json()["items"]]

    # Words in any order, regardless of case and accents.
    assert found("NOIR desir 2024") == [fendant.json()["id"]]
    assert found("2024 désir") == [fendant.json()["id"]]
    assert found("desir 2023") == []
    assert sorted(found("dupont jean")) == sorted([fendant.json()["id"], other.json()["id"]])
    assert found("100%") == []
    by_number = client.get(
        f"{INVOICES}?search={issued.json()['invoice_number']}", headers=auth_headers
    )
    assert [i["id"] for i in by_number.json()["items"]] == [other.json()["id"]]


def test_issue_invoice(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    resp = client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "issued"
    # From the issue date the API used, so that a run across midnight still passes.
    issued_on = date.fromisoformat(data["issue_date"])
    assert issued_on in (date.today(), date.today() - timedelta(days=1))
    assert data["invoice_number"] == f"{issued_on:%y%m%d}1"
    assert data["due_date"] == (issued_on + timedelta(days=30)).isoformat()  # profile terms


def test_issue_numbers_restart_each_day(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: Session,
):
    def issue() -> dict[str, Any]:
        create = client.post(
            INVOICES, json={"customer_id": customer_id, "lines": [LINE]}, headers=auth_headers
        )
        resp = client.post(f"{INVOICES}/{create.json()['id']}/issue", headers=auth_headers)
        invoice: dict[str, Any] = resp.json()
        return invoice

    first = issue()
    yesterday = date.today() - timedelta(days=1)
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(first["id"]))
        .values(invoice_number=f"{yesterday:%y%m%d}1")
    )
    db_session.commit()

    second = issue()
    today = f"{date.fromisoformat(second['issue_date']):%y%m%d}"
    assert second["invoice_number"] == f"{today}1"
    assert issue()["invoice_number"] == f"{today}2"
    # Unpadded: the tenth of the day follows the ninth, also when sorted by number.
    for _ in range(8):
        issue()
    assert issue()["invoice_number"] == f"{today}11"
    listed = client.get(
        INVOICES,
        params={"sort": "number", "order": "desc", "per_page": 3},
        headers=auth_headers,
    ).json()["items"]
    assert [i["invoice_number"] for i in listed] == [f"{today}11", f"{today}10", f"{today}9"]


def test_issue_number_skips_numbers_with_letters(
    complete_profile: None, make_invoice: MakeInvoice, db_session: Session
):
    first = make_invoice("issue")
    stem = first["invoice_number"][:6]
    # Numbers imported before 1.0 may end with letters: they never count.
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(first["id"]))
        .values(invoice_number=f"{stem}5840pr")
    )
    db_session.commit()

    second = make_invoice("issue")
    assert second["invoice_number"] == f"{stem}1"


def test_issue_invoice_requires_complete_profile(
    client: TestClient, auth_headers: dict[str, str], customer_id: str
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    resp = client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    assert resp.status_code == 422
    assert "incomplete" in resp.json()["detail"]

    listed = client.get(INVOICES, headers=auth_headers)
    assert listed.json()["items"][0]["status"] == "draft"


def test_pay_invoice(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "paid"
    assert resp.json()["paid_at"] == date.today().isoformat()


def test_update_payment_date(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
):
    create = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)

    response = client.patch(
        f"{INVOICES}/{invoice_id}/payment-date",
        json={"paid_at": "2025-03-12"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["paid_at"] == "2025-03-12"


def test_pay_with_date_and_method(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
):
    def issued(method: str | None) -> str:
        invoice_id = str(
            client.post(
                INVOICES,
                json={
                    "customer_id": customer_id,
                    "lines": [LINE],
                    "payment_method": method,
                },
                headers=auth_headers,
            ).json()["id"]
        )
        client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
        return invoice_id

    # Without a body: paid today, the planned payment method kept.
    invoice_id = issued("iban")
    data = client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers).json()
    assert data["status"] == "paid"
    assert data["paid_at"] == date.today().isoformat()
    assert data["payment_method"] == "iban"

    # A TWINT payment received a few days ago on an invoice planned as a transfer.
    invoice_id = issued("iban")
    resp = client.post(
        f"{INVOICES}/{invoice_id}/pay",
        json={
            "paid_at": "2026-09-28",
            "payment_method": "twint",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["paid_at"] == "2026-09-28"
    assert resp.json()["payment_method"] == "twint"

    invoice_id = issued(None)
    resp = client.post(
        f"{INVOICES}/{invoice_id}/pay", json={"payment_method": "card"}, headers=auth_headers
    )
    assert resp.status_code == 422


def test_update_payment_method(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
):
    def patch(invoice_id: str, method: str) -> Response:
        response: Response = client.patch(
            f"{INVOICES}/{invoice_id}/payment-method",
            json={"payment_method": method},
            headers=auth_headers,
        )
        return response

    invoice_id = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
            "payment_method": "cash",
        },
        headers=auth_headers,
    ).json()["id"]
    assert patch(invoice_id, "twint").status_code == 409  # draft: through PUT

    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = patch(invoice_id, "twint")
    assert resp.status_code == 200
    assert resp.json()["payment_method"] == "twint"

    client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    assert patch(invoice_id, "iban").json()["payment_method"] == "iban"

    cancelled_id = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    ).json()["id"]
    client.post(f"{INVOICES}/{cancelled_id}/cancel", headers=auth_headers)
    assert patch(cancelled_id, "cash").status_code == 409


def test_cancel_draft(client: TestClient, auth_headers: dict[str, str], customer_id: str):
    create = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    invoice_id = create.json()["id"]
    resp = client.post(f"{INVOICES}/{invoice_id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_delete_only_drafts_cancelled_before_issue(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    def invoice(*steps: str) -> str:
        create = client.post(
            INVOICES, json={"customer_id": customer_id, "lines": [LINE]}, headers=auth_headers
        )
        invoice_id: str = create.json()["id"]
        for step in steps:
            client.post(f"{INVOICES}/{invoice_id}/{step}", headers=auth_headers)
        return invoice_id

    for kept in (invoice(), invoice("issue"), invoice("issue", "cancel")):
        resp = client.delete(f"{INVOICES}/{kept}", headers=auth_headers)
        assert resp.status_code == 409

    cancelled_draft = invoice("cancel")
    resp = client.delete(f"{INVOICES}/{cancelled_draft}", headers=auth_headers)
    assert resp.status_code == 204
    listed = client.get(INVOICES, headers=auth_headers)
    assert cancelled_draft not in [i["id"] for i in listed.json()["items"]]
    assert listed.json()["total"] == 3


def test_cancel_issued(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=auth_headers
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = client.post(f"{INVOICES}/{invoice_id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_download_pdf(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    resp = client.get(f"{INVOICES}/{invoice_id}/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 1000


def _pdf_text(content: bytes) -> str:
    streams = re.findall(rb"stream\r?\n(.*?)\r?\nendstream", content, re.DOTALL)
    return b"".join(zlib.decompress(s) for s in streams if s[:1] == b"x").decode("latin-1")


def test_pdf_shows_twint_payment_only_when_configured(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    pdf_url = f"{INVOICES}/{invoice_id}/pdf"

    without = _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    assert "TWINT" not in without

    profile = client.get("/tenant/profile", headers=auth_headers).json()
    writable = {k: v for k, v in profile.items() if k not in ("id", "tenant_id", "is_complete")}
    client.put(
        "/tenant/profile", json={**writable, "twint_phone": "079 123 45 67"}, headers=auth_headers
    )
    text = _pdf_text(client.get(f"{pdf_url}?lang=en", headers=auth_headers).content)
    assert "Pay with TWINT" in text
    assert "079 123 45 67" in text


def test_pdf_shows_payment_date_once_paid(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    invoice_id = create.json()["id"]
    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    pdf_url = f"{INVOICES}/{invoice_id}/pdf"
    unpaid = _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    assert "Acquittée" not in unpaid
    assert "Récépissé" in unpaid
    assert "Échéance" in unpaid

    client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    client.patch(
        f"{INVOICES}/{invoice_id}/payment-date",
        json={"paid_at": "2026-03-12"},
        headers=auth_headers,
    )
    french = _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    assert "Acquittée le 12.03.2026" in french
    assert "Récépissé" not in french
    assert "Échéance" not in french
    english = _pdf_text(client.get(f"{pdf_url}?lang=en", headers=auth_headers).content)
    assert "Paid on 12.03.2026" in english

    for method, text in [
        ("cash", "Acquittée en espèces le 12.03.2026"),
        ("twint", "Acquittée par TWINT le 12.03.2026"),
        ("iban", "Acquittée par virement le 12.03.2026"),
    ]:
        client.patch(
            f"{INVOICES}/{invoice_id}/payment-method",
            json={"payment_method": method},
            headers=auth_headers,
        )
        assert text in _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    english = _pdf_text(client.get(f"{pdf_url}?lang=en", headers=auth_headers).content)
    assert "Paid by bank transfer on 12.03.2026" in english


def test_company_customer_is_named_without_a_first_name(
    client: TestClient, auth_headers: dict[str, str], complete_profile: None
):
    customer = client.post(
        CUSTOMERS,
        json={"last_name": "Garage du Lac SA", "postal_code": "1932", "city": "Bovernier"},
        headers=auth_headers,
    )
    create = client.post(
        INVOICES,
        json={"customer_id": customer.json()["id"], "lines": [LINE]},
        headers=auth_headers,
    )
    listed = client.get(INVOICES, headers=auth_headers).json()["items"]
    assert listed[0]["customer_name"] == "Garage du Lac SA"
    pdf_url = f"{INVOICES}/{create.json()['id']}/pdf"
    text = _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    assert "(Garage du Lac SA)" in text


def test_pdf_header_shows_company_phone(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    pdf_url = f"{INVOICES}/{create.json()['id']}/pdf"
    assert "Tél." not in _pdf_text(client.get(pdf_url, headers=auth_headers).content)

    profile = client.get("/tenant/profile", headers=auth_headers).json()
    writable = {k: v for k, v in profile.items() if k not in ("id", "tenant_id", "is_complete")}
    client.put("/tenant/profile", json={**writable, "phone": "024 123 45 67"}, headers=auth_headers)
    assert "Tél. : 024 123 45 67" in _pdf_text(client.get(pdf_url, headers=auth_headers).content)


def test_pdf_leaves_out_the_internal_notes(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={"customer_id": customer_id, "lines": [LINE], "notes": "Internal reminder"},
        headers=auth_headers,
    )
    pdf = client.get(f"{INVOICES}/{create.json()['id']}/pdf", headers=auth_headers)
    assert "Internal reminder" not in _pdf_text(pdf.content)


def test_pdf_language(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    create = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    )
    pdf_url = f"{INVOICES}/{create.json()['id']}/pdf"

    french = _pdf_text(client.get(pdf_url, headers=auth_headers).content)
    assert "Facture" in french and "Récépissé" in french
    assert "Invoice" not in french

    english = _pdf_text(client.get(f"{pdf_url}?lang=en", headers=auth_headers).content)
    assert "Invoice" in english and "Receipt" in english

    resp = client.get(f"{pdf_url}?lang=de", headers=auth_headers)
    assert resp.status_code == 422


def test_invoice_tenant_isolation(
    client: TestClient,
    auth_headers: dict[str, str],
    other_headers: dict[str, str],
    customer_id: str,
    article_id: str,
    make_invoice: MakeInvoice,
):
    invoice_id = make_invoice()["id"]

    resp = client.get(INVOICES, headers=other_headers)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []
    for method, path in [
        ("GET", ""),
        ("PUT", ""),
        ("DELETE", ""),
        ("GET", "/pdf"),
        ("POST", "/issue"),
        ("POST", "/pay"),
        ("POST", "/cancel"),
        ("POST", "/reminders"),
        ("PATCH", "/payment-date"),
        ("PATCH", "/payment-method"),
        ("GET", "/reminders/1/pdf"),
    ]:
        body = {
            "PUT": {"customer_id": customer_id, "lines": []},
            "PATCH": {"paid_at": "2026-01-01", "payment_method": "cash"},
        }.get(method)
        resp = client.request(
            method,
            f"{INVOICES}/{invoice_id}{path}",
            headers=other_headers,
            json=body,
        )
        assert resp.status_code == 404, (method, path, resp.status_code)

    # Nor can another tenant bill this tenant's customer or article.
    other_line = {**LINE, "article_id": article_id}
    resp = client.post(
        INVOICES, json={"customer_id": customer_id, "lines": []}, headers=other_headers
    )
    assert resp.status_code == 400
    own_customer = client.post(
        CUSTOMERS,
        json={
            "first_name": "Ana",
            "last_name": "Other",
            "address_line1": "",
            "postal_code": "",
            "city": "",
            "country": "CH",
            "email": None,
            "phones": [],
        },
        headers=other_headers,
    ).json()["id"]
    resp = client.post(
        INVOICES, json={"customer_id": own_customer, "lines": [other_line]}, headers=other_headers
    )
    assert resp.status_code == 400


def test_chf_uses_swiss_thousands_separator():
    assert _chf(Decimal("1234.50")) == "1'234.50"
    assert _chf(Decimal("-13.50")) == "-13.50"
    assert _chf(Decimal("1234567.89"), " ") == "1 234 567.89"


def test_sort_invoices(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    def create(quantity: int, discount: str = "0") -> str:
        resp = client.post(
            INVOICES,
            json={
                "customer_id": customer_id,
                "discount_percent": discount,
                "lines": [{**LINE, "quantity": quantity}],
            },
            headers=auth_headers,
        )
        return str(resp.json()["id"])

    small = create(1)  # 50 + VAT = 54.05
    big = create(3, discount="50")  # 150 - 50 % + VAT = 81.08
    medium = create(2)  # 100 + VAT = 108.10
    client.post(f"{INVOICES}/{medium}/issue", headers=auth_headers)
    client.post(f"{INVOICES}/{big}/issue", headers=auth_headers)
    client.post(f"{INVOICES}/{big}/pay", headers=auth_headers)

    def ids(query: str) -> list[str]:
        resp = client.get(f"{INVOICES}?{query}", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        return [i["id"] for i in resp.json()["items"]]

    assert ids("sort=total") == [small, big, medium]
    assert ids("sort=total&order=desc") == [medium, big, small]
    # Workflow order: draft, issued, paid.
    assert ids("sort=status") == [small, medium, big]
    # The draft has no number yet: last in both directions.
    assert ids("sort=number")[-1] == small
    assert ids("sort=number&order=desc")[-1] == small
    assert len(ids("sort=customer")) == 3


def test_payment_reminders(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: Session,
):
    invoice_id = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    ).json()["id"]
    reminders = f"{INVOICES}/{invoice_id}/reminders"
    assert client.post(reminders, headers=auth_headers).status_code == 409  # draft

    client.post(f"{INVOICES}/{invoice_id}/issue", headers=auth_headers)
    assert client.post(reminders, headers=auth_headers).status_code == 409  # not due yet

    today = date.today()
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(invoice_id))
        .values(due_date=today - timedelta(days=1))
    )
    db_session.commit()

    first = client.post(reminders, headers=auth_headers)
    assert first.status_code == 201
    deadline = (today + timedelta(days=10)).isoformat()  # reminder_terms_days of the profile
    assert first.json()["reminders"] == [
        {"number": 1, "sent_on": today.isoformat(), "due_on": deadline},
    ]
    second = client.post(reminders, headers=auth_headers).json()
    assert [r["number"] for r in second["reminders"]] == [1, 2]
    # Listed with the invoice, and reported on the dashboard.
    listed = client.get(INVOICES, headers=auth_headers).json()["items"][0]
    assert len(listed["reminders"]) == 2
    overdue = client.get("/dashboard/stats", headers=auth_headers).json()["overdue_invoices"]
    assert overdue[0]["reminder_count"] == 2
    assert overdue[0]["last_reminder_on"] == today.isoformat()

    # Printing a reminder again creates none.
    pdf = client.get(f"{reminders}/2/pdf", headers=auth_headers)
    assert pdf.status_code == 200
    text = _pdf_text(pdf.content)
    assert "2e rappel" in text
    assert "Récépissé" in text  # still payable with the QR-bill
    english = _pdf_text(client.get(f"{reminders}/1/pdf?lang=en", headers=auth_headers).content)
    assert "Reminder" in english
    assert (
        len(client.get(f"{INVOICES}/{invoice_id}", headers=auth_headers).json()["reminders"]) == 2
    )
    assert client.get(f"{reminders}/3/pdf", headers=auth_headers).status_code == 404

    # Paid: no more reminders.
    client.post(f"{INVOICES}/{invoice_id}/pay", headers=auth_headers)
    assert client.post(reminders, headers=auth_headers).status_code == 409


def test_pdf_prints_the_vat_number_only_when_registered(
    client: TestClient, auth_headers: dict[str, str], customer_id: str, complete_profile: None
):
    invoice_id = client.post(
        INVOICES,
        json={
            "customer_id": customer_id,
            "lines": [LINE],
        },
        headers=auth_headers,
    ).json()["id"]
    pdf_url = f"{INVOICES}/{invoice_id}/pdf"
    assert "N° TVA" not in _pdf_text(client.get(pdf_url, headers=auth_headers).content)

    profile = client.get("/tenant/profile", headers=auth_headers).json()
    writable = {k: v for k, v in profile.items() if k not in ("id", "tenant_id", "is_complete")}
    resp = client.put(
        "/tenant/profile",
        json={**writable, "vat_number": "CHE-123.456.789 TVA"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "N° TVA : CHE-123.456.789 TVA" in _pdf_text(
        client.get(pdf_url, headers=auth_headers).content
    )


def _article_line(article_id: str, quantity: int) -> dict[str, object]:
    return {
        "article_id": article_id,
        "description_snapshot": "Pinot Noir",
        "quantity": quantity,
        "unit_price_snapshot": "28.00",
        "vat_rate_snapshot": None,
    }


def _stock(client: TestClient, headers: dict[str, str], article_id: str) -> int:
    return int(client.get(f"/articles/{article_id}", headers=headers).json()["stock_quantity"])


def test_issue_takes_the_stock_and_cancel_gives_it_back(
    client: TestClient,
    auth_headers: dict[str, str],
    article_id: str,
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    draft = make_invoice(lines=[_article_line(article_id, 3)])
    assert _stock(client, auth_headers, article_id) == 10  # a draft takes nothing

    issued = make_invoice("issue", lines=[_article_line(article_id, 4)])
    assert _stock(client, auth_headers, article_id) == 6

    client.post(f"{INVOICES}/{draft['id']}/cancel", headers=auth_headers)
    assert _stock(client, auth_headers, article_id) == 6  # nothing to give back

    client.post(f"{INVOICES}/{issued['id']}/cancel", headers=auth_headers)
    assert _stock(client, auth_headers, article_id) == 10


@pytest.mark.parametrize(
    ("steps", "action"),
    [
        (("issue",), "PUT"),  # only a draft is edited
        (("issue",), "issue"),
        ((), "pay"),  # a draft is not payable
        (("issue", "pay"), "pay"),
        (("issue", "cancel"), "pay"),
        (("issue",), "payment-date"),  # only a paid invoice has one
        (("issue", "pay"), "cancel"),  # a paid invoice is kept
        (("issue", "cancel"), "cancel"),
    ],
)
def test_actions_refused_in_the_wrong_status(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    make_invoice: MakeInvoice,
    steps: tuple[str, ...],
    action: str,
):
    invoice_id = make_invoice(*steps)["id"]
    url = f"{INVOICES}/{invoice_id}"
    if action == "PUT":
        resp = client.put(url, json={"customer_id": customer_id, "lines": []}, headers=auth_headers)
    elif action == "payment-date":
        resp = client.patch(
            f"{url}/payment-date", json={"paid_at": "2026-01-01"}, headers=auth_headers
        )
    else:
        resp = client.post(f"{url}/{action}", headers=auth_headers)
    assert resp.status_code == 409


def test_list_invoices_by_status(
    client: TestClient,
    auth_headers: dict[str, str],
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    draft = make_invoice()
    issued = make_invoice("issue")
    paid = make_invoice("issue", "pay")

    def ids(status: str) -> list[str]:
        resp = client.get(INVOICES, params={"status": status}, headers=auth_headers)
        return [i["id"] for i in resp.json()["items"]]

    assert ids("draft") == [draft["id"]]
    assert ids("issued") == [issued["id"]]
    assert ids("paid") == [paid["id"]]
    assert ids("cancelled") == []
    resp = client.get(INVOICES, params={"status": "sent"}, headers=auth_headers)
    assert resp.status_code == 422


def test_lines_keep_the_order_they_are_sent_in(
    client: TestClient, auth_headers: dict[str, str], make_invoice: MakeInvoice
):
    def line(description: str) -> dict[str, Any]:
        return {
            "article_id": None,
            "description_snapshot": description,
            "quantity": 1,
            "unit_price_snapshot": "10.00",
            "vat_rate_snapshot": None,
        }

    # Saved in one go, the lines share their created_at: only the position orders them.
    names = ["Zèbre", "Abricot", "Moka", "Bière", "Yaourt"]
    invoice = make_invoice(lines=[line(name) for name in names])
    assert [line["description_snapshot"] for line in invoice["lines"]] == names

    reordered = names[::-1]
    resp = client.put(
        f"{INVOICES}/{invoice['id']}",
        json={"customer_id": invoice["customer_id"], "lines": [line(n) for n in reordered]},
        headers=auth_headers,
    )
    assert [line["description_snapshot"] for line in resp.json()["lines"]] == reordered
    resp = client.get(f"{INVOICES}/{invoice['id']}", headers=auth_headers)
    assert [line["description_snapshot"] for line in resp.json()["lines"]] == reordered
