import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import TenantProfile, User
from app.services.tenants import TenantError, create_tenant, set_password
from tests.conftest import PASSWORD, signed_in

TENANT = {"name": "Cave", "subdomain": "cave", "email": "admin@cave.ch"}


async def _login(client: AsyncClient, email: str, password: str) -> int:
    response = await client.post("/auth/login", json={"email": email, "password": password})
    return response.status_code


@pytest.mark.anyio
async def test_create_tenant_with_its_admin_and_an_empty_profile(
    client: AsyncClient, db_session: AsyncSession
):
    user = await create_tenant(db_session, **TENANT, password=PASSWORD)
    await db_session.commit()

    profile = await db_session.scalar(
        select(TenantProfile).where(TenantProfile.tenant_id == user.tenant_id)
    )
    assert profile is not None
    assert profile.company_name == "Cave"
    assert profile.is_complete is False
    assert await _login(client, "admin@cave.ch", PASSWORD) == 200


@pytest.mark.anyio
@pytest.mark.parametrize(
    "change, message",
    [
        ({"subdomain": "cave-b"}, "Email already registered"),
        ({"email": "other@cave.ch"}, "Subdomain already taken"),
    ],
)
async def test_create_tenant_refuses_a_taken_email_or_subdomain(
    db_session: AsyncSession, change: dict[str, str], message: str
):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    with pytest.raises(TenantError, match=message):
        await create_tenant(db_session, **(TENANT | change), password=PASSWORD)


@pytest.mark.anyio
@pytest.mark.parametrize(
    "change, message",
    [
        ({"password": "12345678"}, "at least 9 characters"),
        ({"email": "not-an-email"}, "Invalid email"),
        ({"name": " "}, "required"),
    ],
)
async def test_create_tenant_validates_its_input(
    db_session: AsyncSession, change: dict[str, str], message: str
):
    with pytest.raises(TenantError, match=message):
        await create_tenant(db_session, **({**TENANT, "password": PASSWORD} | change))
    assert await db_session.scalar(select(User)) is None


@pytest.mark.anyio
async def test_set_password(client: AsyncClient, db_session: AsyncSession):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    await set_password(db_session, email="admin@cave.ch", password="new-secret-1")
    await db_session.commit()

    assert await _login(client, "admin@cave.ch", PASSWORD) == 401
    assert await _login(client, "admin@cave.ch", "new-secret-1") == 200

    with pytest.raises(TenantError, match="at least 9 characters"):
        await set_password(db_session, email="admin@cave.ch", password="short")
    with pytest.raises(TenantError, match="No user"):
        await set_password(db_session, email="ghost@cave.ch", password="new-secret-1")


@pytest.mark.anyio
@pytest.mark.parametrize("sign_out", [False, True])
async def test_set_password_ends_open_sessions_only_when_asked(
    client: AsyncClient, db_session: AsyncSession, sign_out: bool
):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    await db_session.commit()
    tokens = (
        await client.post("/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD})
    ).json()

    await set_password(
        db_session, email="admin@cave.ch", password="new-secret-1", sign_out=sign_out
    )
    await db_session.commit()

    expected = 401 if sign_out else 200
    access = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (await client.get("/tenant/profile", headers=access)).status_code == expected
    refreshed = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == expected
    # A new sign-in works either way.
    assert await _login(client, "admin@cave.ch", "new-secret-1") == 200


@pytest.mark.anyio
async def test_tenants_are_not_created_over_the_api(client: AsyncClient):
    payload = {"tenant_name": "Cave", "subdomain": "cave", "email": "a@cave.ch", "password": "x"}
    response = await client.post("/auth/register", json=payload)
    assert response.status_code == 404


@pytest.mark.anyio
async def test_login_returns_tokens(client: AsyncClient, db_session: AsyncSession):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    await db_session.commit()
    response = await client.post(
        "/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_login_wrong_password_returns_401(client: AsyncClient, db_session: AsyncSession):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    await db_session.commit()
    assert await _login(client, "admin@cave.ch", "wrongpassword") == 401


@pytest.mark.anyio
async def test_login_unknown_email_returns_401(client: AsyncClient):
    assert await _login(client, "ghost@test.ch", "whatever") == 401


@pytest.mark.anyio
async def test_refresh_returns_new_tokens(client: AsyncClient, db_session: AsyncSession):
    await create_tenant(db_session, **TENANT, password=PASSWORD)
    await db_session.commit()
    login = await client.post("/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD})

    response = await client.post(
        "/auth/refresh", json={"refresh_token": login.json()["refresh_token"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.anyio
async def test_refresh_invalid_token_returns_401(client: AsyncClient):
    response = await client.post("/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert response.status_code == 401


@pytest.mark.anyio
async def test_tokens_are_not_interchangeable(client: AsyncClient, db_session: AsyncSession):
    await signed_in(client, db_session, **TENANT)
    tokens = (
        await client.post("/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD})
    ).json()

    # A refresh token does not open the API…
    as_access = await client.get(
        "/tenant/profile", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert as_access.status_code == 401
    # …and an access token is not traded for new tokens.
    as_refresh = await client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert as_refresh.status_code == 401
    # Each one works for its own use.
    assert (
        await client.get(
            "/tenant/profile", headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
    ).status_code == 200
    assert (
        await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 200
