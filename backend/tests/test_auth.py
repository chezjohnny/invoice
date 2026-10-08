import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import TenantProfile, User
from app.services.tenants import TenantError, create_tenant, set_password
from tests.conftest import PASSWORD, signed_in

TENANT = {"name": "Cave", "subdomain": "cave", "email": "admin@cave.ch"}


def _login(client: TestClient, email: str, password: str) -> int:
    status: int = client.post(
        "/auth/login", json={"email": email, "password": password}
    ).status_code
    return status


def test_create_tenant_with_its_admin_and_an_empty_profile(client: TestClient, db_session: Session):
    user = create_tenant(db_session, **TENANT, password=PASSWORD)
    db_session.commit()

    profile = db_session.scalar(
        select(TenantProfile).where(TenantProfile.tenant_id == user.tenant_id)
    )
    assert profile is not None
    assert profile.company_name == "Cave"
    assert profile.is_complete is False
    assert _login(client, "admin@cave.ch", PASSWORD) == 200


@pytest.mark.parametrize(
    "change, message",
    [
        ({"subdomain": "cave-b"}, "Email already registered"),
        ({"email": "other@cave.ch"}, "Subdomain already taken"),
    ],
)
def test_create_tenant_refuses_a_taken_email_or_subdomain(
    db_session: Session, change: dict[str, str], message: str
):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    with pytest.raises(TenantError, match=message):
        create_tenant(db_session, **(TENANT | change), password=PASSWORD)


@pytest.mark.parametrize(
    "change, message",
    [
        ({"password": "12345678"}, "at least 9 characters"),
        ({"email": "not-an-email"}, "Invalid email"),
        ({"name": " "}, "required"),
    ],
)
def test_create_tenant_validates_its_input(
    db_session: Session, change: dict[str, str], message: str
):
    with pytest.raises(TenantError, match=message):
        create_tenant(db_session, **({**TENANT, "password": PASSWORD} | change))
    assert db_session.scalar(select(User)) is None


def test_set_password(client: TestClient, db_session: Session):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    set_password(db_session, email="admin@cave.ch", password="new-secret-1")
    db_session.commit()

    assert _login(client, "admin@cave.ch", PASSWORD) == 401
    assert _login(client, "admin@cave.ch", "new-secret-1") == 200

    with pytest.raises(TenantError, match="at least 9 characters"):
        set_password(db_session, email="admin@cave.ch", password="short")
    with pytest.raises(TenantError, match="No user"):
        set_password(db_session, email="ghost@cave.ch", password="new-secret-1")


@pytest.mark.parametrize("sign_out", [False, True])
def test_set_password_ends_open_sessions_only_when_asked(
    client: TestClient, db_session: Session, sign_out: bool
):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    db_session.commit()
    tokens = client.post(
        "/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD}
    ).json()

    set_password(db_session, email="admin@cave.ch", password="new-secret-1", sign_out=sign_out)
    db_session.commit()

    expected = 401 if sign_out else 200
    access = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.get("/tenant/profile", headers=access).status_code == expected
    refreshed = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == expected
    # A new sign-in works either way.
    assert _login(client, "admin@cave.ch", "new-secret-1") == 200


def test_tenants_are_not_created_over_the_api(client: TestClient):
    payload = {"tenant_name": "Cave", "subdomain": "cave", "email": "a@cave.ch", "password": "x"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 404


def test_login_returns_tokens(client: TestClient, db_session: Session):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    db_session.commit()
    response = client.post("/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client: TestClient, db_session: Session):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    db_session.commit()
    assert _login(client, "admin@cave.ch", "wrongpassword") == 401


def test_login_unknown_email_returns_401(client: TestClient):
    assert _login(client, "ghost@test.ch", "whatever") == 401


def test_refresh_returns_new_tokens(client: TestClient, db_session: Session):
    create_tenant(db_session, **TENANT, password=PASSWORD)
    db_session.commit()
    login = client.post("/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD})

    response = client.post("/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_invalid_token_returns_401(client: TestClient):
    response = client.post("/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert response.status_code == 401


def test_tokens_are_not_interchangeable(client: TestClient, db_session: Session):
    signed_in(client, db_session, **TENANT)
    tokens = client.post(
        "/auth/login", json={"email": "admin@cave.ch", "password": PASSWORD}
    ).json()

    # A refresh token does not open the API…
    as_access = client.get(
        "/tenant/profile", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert as_access.status_code == 401
    # …and an access token is not traded for new tokens.
    as_refresh = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert as_refresh.status_code == 401
    # Each one works for its own use.
    assert (
        client.get("/tenant/profile", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    ).status_code == 200
    assert (
        client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 200
