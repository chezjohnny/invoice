import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import TenantProfile

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


@pytest.mark.anyio
async def test_partial_payload_is_rejected(client: AsyncClient, auth_headers: dict[str, str]):
    """PUT replaces the whole profile, so an incomplete body must not be
    completed with defaults — that would silently wipe the omitted fields."""
    await client.put(PROFILE, json=VALID, headers=auth_headers)

    resp = await client.put(
        PROFILE, json={"company_name": "Cave du Coteau"}, headers=auth_headers
    )
    assert resp.status_code == 422

    unchanged = (await client.get(PROFILE, headers=auth_headers)).json()
    assert unchanged["city"] == "Rolle"
    assert unchanged["invoice_prefix"] == "CDC"


@pytest.mark.anyio
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
async def test_oversize_values_are_rejected(
    client: AsyncClient, auth_headers: dict[str, str], payload: dict[str, object]
):
    """The columns are bounded; without matching limits the INSERT would fail
    with a DataError (500) instead of a field-level 422."""
    resp = await client.put(PROFILE, json={**VALID, **payload}, headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_get_serves_a_profile_the_input_rules_would_reject(
    client: AsyncClient, auth_headers: dict[str, str], db_session: AsyncSession
):
    """Rows written before the IBAN rules (fixtures, earlier versions) must stay
    readable, otherwise the page that would fix them is unreachable."""
    profile = (await db_session.execute(select(TenantProfile))).scalar_one()
    profile.iban = "FR7630006000011234567890189"
    await db_session.commit()

    resp = await client.get(PROFILE, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["iban"] == "FR7630006000011234567890189"
