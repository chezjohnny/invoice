import pytest
from httpx import AsyncClient

AUTH = "/auth"
PROFILE = "/tenant/profile"

VALID = {
    "company_name": "Cave du Coteau",
    "address_line1": "Route du Vignoble 4",
    "address_line2": "Bâtiment B",
    "postal_code": "1180",
    "city": "Rolle",
    "country": "CH",
    "iban": "CH93 0076 2011 6238 5295 7",
    "vat_number": "CHE-123.456.789 TVA",
    "default_vat_rate": "0.081",
    "invoice_prefix": "CDC",
    "payment_terms_days": 15,
}


@pytest.mark.anyio
async def test_new_tenant_profile_is_incomplete(
    client: AsyncClient, auth_headers: dict[str, str]
):
    resp = await client.get(PROFILE, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_name"] == "Cave Test"
    assert data["iban"] is None
    assert data["city"] == ""
    assert data["is_complete"] is False
    assert data["invoice_next_number"] == 1


@pytest.mark.anyio
async def test_update_profile(client: AsyncClient, auth_headers: dict[str, str]):
    resp = await client.put(PROFILE, json=VALID, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is True
    assert data["iban"] == "CH9300762011623852957"  # normalised
    assert data["default_vat_rate"] == "0.0810"
    assert data["invoice_prefix"] == "CDC"

    reread = await client.get(PROFILE, headers=auth_headers)
    assert reread.json() == data


@pytest.mark.anyio
async def test_update_profile_keeps_invoice_counter(
    client: AsyncClient, auth_headers: dict[str, str]
):
    resp = await client.put(
        PROFILE, json={**VALID, "invoice_next_number": 999}, headers=auth_headers
    )
    assert resp.json()["invoice_next_number"] == 1


@pytest.mark.anyio
async def test_blank_optional_fields_are_stored_as_null(
    client: AsyncClient, auth_headers: dict[str, str]
):
    resp = await client.put(
        PROFILE,
        json={**VALID, "iban": "", "vat_number": "  ", "address_line2": ""},
        headers=auth_headers,
    )
    data = resp.json()
    assert data["iban"] is None
    assert data["vat_number"] is None
    assert data["address_line2"] is None
    assert data["is_complete"] is False


@pytest.mark.anyio
@pytest.mark.parametrize(
    "payload",
    [
        {"iban": "CH0000000000000000000"},  # bad checksum
        {"iban": "CH930076201162385295"},  # too short
        {"iban": "FR7630006000011234567890189"},  # not CH/LI
        {"company_name": "   "},
        {"default_vat_rate": "1.5"},
        {"payment_terms_days": -1},
    ],
)
async def test_invalid_profile_payloads(
    client: AsyncClient, auth_headers: dict[str, str], payload: dict[str, object]
):
    resp = await client.put(PROFILE, json={**VALID, **payload}, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_profile_tenant_isolation(client: AsyncClient, auth_headers: dict[str, str]):
    await client.put(PROFILE, json=VALID, headers=auth_headers)

    await client.post(f"{AUTH}/register", json={
        "tenant_name": "Other", "subdomain": "other-profile",
        "email": "other@profile.ch", "password": "secret123",
    })
    login = await client.post(f"{AUTH}/login", json={
        "email": "other@profile.ch", "password": "secret123",
    })
    other = {"Authorization": f"Bearer {login.json()['access_token']}"}

    resp = await client.get(PROFILE, headers=other)
    assert resp.json()["company_name"] == "Other"
    assert resp.json()["is_complete"] is False


@pytest.mark.anyio
async def test_profile_requires_auth(client: AsyncClient):
    assert (await client.get(PROFILE)).status_code == 401
