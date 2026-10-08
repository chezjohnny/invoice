import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import TenantProfile

PROFILE = "/tenant/profile"

VALID = {
    "company_name": "Cave du Coteau",
    "address_line1": "Route du Vignoble 4",
    "address_line2": "Bâtiment B",
    "postal_code": "1180",
    "city": "Rolle",
    "country": "CH",
    "iban": "CH93 0076 2011 6238 5295 7",
    "twint_phone": "079 123 45 67",
    "phone": "024 123 45 67",
    "vat_number": "CHE-123.456.789 TVA",
    "default_vat_rate": "0.081",
    "payment_terms_days": 15,
    "reminder_terms_days": 7,
}


def test_new_tenant_profile_is_incomplete(client: TestClient, auth_headers: dict[str, str]):
    resp = client.get(PROFILE, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_name"] == "Cave Test"
    assert data["iban"] is None
    assert data["city"] == ""
    assert data["is_complete"] is False


def test_update_profile(client: TestClient, auth_headers: dict[str, str]):
    resp = client.put(PROFILE, json=VALID, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is True
    assert data["iban"] == "CH9300762011623852957"  # normalised
    assert data["twint_phone"] == "+41791234567"
    assert data["default_vat_rate"] == "0.0810"

    reread = client.get(PROFILE, headers=auth_headers)
    assert reread.json() == data


@pytest.mark.parametrize(
    "phone", ["0791234567", "+41 79 123 45 67", "0041 79 123 45 67", "079/123.45.67"]
)
def test_twint_phone_is_normalised(client: TestClient, auth_headers: dict[str, str], phone: str):
    resp = client.put(PROFILE, json={**VALID, "twint_phone": phone}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["twint_phone"] == "+41791234567"


@pytest.mark.parametrize(
    ("phone", "expected"),
    [("024 123 45 67", "+41241234567"), ("+33 1 23 45 67 89", "+33123456789")],
)
def test_phone_is_normalised(
    client: TestClient, auth_headers: dict[str, str], phone: str, expected: str
):
    resp = client.put(PROFILE, json={**VALID, "phone": phone}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["phone"] == expected


def test_invalid_phone_is_rejected(client: TestClient, auth_headers: dict[str, str]):
    resp = client.put(PROFILE, json={**VALID, "phone": "12"}, headers=auth_headers)
    assert resp.status_code == 422


def test_blank_optional_fields_are_stored_as_null(client: TestClient, auth_headers: dict[str, str]):
    resp = client.put(
        PROFILE,
        json={**VALID, "iban": "", "twint_phone": " ", "vat_number": "  ", "address_line2": ""},
        headers=auth_headers,
    )
    data = resp.json()
    assert data["iban"] is None
    assert data["twint_phone"] is None
    assert data["vat_number"] is None
    assert data["address_line2"] is None
    assert data["is_complete"] is False


@pytest.mark.parametrize(
    "payload",
    [
        {"iban": "CH0000000000000000000"},  # bad checksum
        {"iban": "CH930076201162385295"},  # too short
        {"iban": "FR7630006000011234567890189"},  # not CH/LI
        {"twint_phone": "021 123 45 67"},  # landline
        {"twint_phone": "+33 6 12 34 56 78"},  # not Swiss
        {"twint_phone": "079 123 45 6"},  # too short
        {"company_name": "   "},
        {"default_vat_rate": "1.5"},
        {"payment_terms_days": -1},
        {"reminder_terms_days": -1},
    ],
)
def test_invalid_profile_payloads(
    client: TestClient, auth_headers: dict[str, str], payload: dict[str, object]
):
    resp = client.put(PROFILE, json={**VALID, **payload}, headers=auth_headers)
    assert resp.status_code == 422


def test_profile_tenant_isolation(
    client: TestClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    client.put(PROFILE, json=VALID, headers=auth_headers)

    resp = client.get(PROFILE, headers=other_headers)
    assert resp.json()["company_name"] == "Other"
    assert resp.json()["is_complete"] is False


def test_profile_requires_auth(client: TestClient):
    assert client.get(PROFILE).status_code == 401


def test_partial_payload_is_rejected(client: TestClient, auth_headers: dict[str, str]):
    """PUT replaces the whole profile, so an incomplete body must not be
    completed with defaults — that would silently wipe the omitted fields."""
    client.put(PROFILE, json=VALID, headers=auth_headers)

    resp = client.put(PROFILE, json={"company_name": "Cave du Coteau"}, headers=auth_headers)
    assert resp.status_code == 422

    unchanged = client.get(PROFILE, headers=auth_headers).json()
    assert unchanged["city"] == "Rolle"
    assert unchanged["payment_terms_days"] == 15


@pytest.mark.parametrize(
    "payload",
    [
        {"company_name": "x" * 256},
        {"address_line1": "x" * 256},
        {"postal_code": "x" * 21},
        {"city": "x" * 101},
        {"vat_number": "x" * 21},
    ],
)
def test_oversize_values_are_rejected(
    client: TestClient, auth_headers: dict[str, str], payload: dict[str, object]
):
    """The columns are bounded; without matching limits the INSERT would fail
    with a DataError (500) instead of a field-level 422."""
    resp = client.put(PROFILE, json={**VALID, **payload}, headers=auth_headers)
    assert resp.status_code == 422


def test_get_serves_a_profile_the_input_rules_would_reject(
    client: TestClient, auth_headers: dict[str, str], db_session: Session
):
    """Rows written before the IBAN rules (fixtures, earlier versions) must stay
    readable, otherwise the page that would fix them is unreachable."""
    profile = db_session.execute(select(TenantProfile)).scalar_one()
    profile.iban = "FR7630006000011234567890189"
    db_session.commit()

    resp = client.get(PROFILE, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["iban"] == "FR7630006000011234567890189"
