import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_register_creates_tenant_and_user(client: AsyncClient):
    response = await client.post("/auth/register", json={
        "tenant_name": "Cave du Soleil",
        "subdomain": "cave",
        "email": "admin@cave.ch",
        "password": "secret123",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "admin@cave.ch"
    assert "id" in data
    assert "tenant_id" in data
    assert "hashed_password" not in data


@pytest.mark.anyio
async def test_register_duplicate_email_returns_409(client: AsyncClient):
    payload = {
        "tenant_name": "Cave A",
        "subdomain": "cave-a",
        "email": "duplicate@cave.ch",
        "password": "secret123",
    }
    await client.post("/auth/register", json=payload)
    response = await client.post("/auth/register", json={**payload, "subdomain": "cave-b"})
    assert response.status_code == 409


@pytest.mark.anyio
async def test_register_duplicate_subdomain_returns_409(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "Cave B",
        "subdomain": "same-subdomain",
        "email": "b@cave.ch",
        "password": "secret123",
    })
    response = await client.post("/auth/register", json={
        "tenant_name": "Cave C",
        "subdomain": "same-subdomain",
        "email": "c@cave.ch",
        "password": "secret123",
    })
    assert response.status_code == 409


@pytest.mark.anyio
async def test_login_returns_tokens(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "Login Test",
        "subdomain": "login-test",
        "email": "login@test.ch",
        "password": "mypassword",
    })
    response = await client.post("/auth/login", json={
        "email": "login@test.ch",
        "password": "mypassword",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.anyio
async def test_login_wrong_password_returns_401(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "Wrong Pass",
        "subdomain": "wrong-pass",
        "email": "wrong@test.ch",
        "password": "correctpassword",
    })
    response = await client.post("/auth/login", json={
        "email": "wrong@test.ch",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.anyio
async def test_login_unknown_email_returns_401(client: AsyncClient):
    response = await client.post("/auth/login", json={
        "email": "ghost@test.ch",
        "password": "whatever",
    })
    assert response.status_code == 401


@pytest.mark.anyio
async def test_refresh_returns_new_tokens(client: AsyncClient):
    await client.post("/auth/register", json={
        "tenant_name": "Refresh Test",
        "subdomain": "refresh-test",
        "email": "refresh@test.ch",
        "password": "mypassword",
    })
    login = await client.post("/auth/login", json={
        "email": "refresh@test.ch",
        "password": "mypassword",
    })
    refresh_token = login.json()["refresh_token"]

    response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.anyio
async def test_refresh_invalid_token_returns_401(client: AsyncClient):
    response = await client.post("/auth/refresh", json={"refresh_token": "not.a.valid.token"})
    assert response.status_code == 401
