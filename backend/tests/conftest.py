from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, configure_sqlite_connection, get_db
from app.main import app
from app.services.tenants import create_tenant


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    event.listen(engine.sync_engine, "connect", configure_sqlite_connection)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db_session: AsyncSession):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


PASSWORD = "secret123"


async def signed_in(
    client: AsyncClient, db: AsyncSession, *, name: str, subdomain: str, email: str
) -> dict[str, str]:
    """A new tenant, as the CLI creates it, then its admin's login headers."""
    await create_tenant(db, name=name, subdomain=subdomain, email=email, password=PASSWORD)
    await db.commit()
    resp = await client.post("/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
async def auth_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    return await signed_in(
        client, db_session, name="Cave Test", subdomain="cave-test", email="cave@test.ch"
    )


@pytest.fixture
async def complete_profile(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    """Fill the company profile so invoices can be issued (address + IBAN required)."""
    resp = await client.put(
        "/tenant/profile",
        json={
            "company_name": "Cave Test",
            "address_line1": "Route du Vignoble 4",
            "address_line2": None,
            "postal_code": "1180",
            "city": "Rolle",
            "country": "CH",
            "iban": "CH9300762011623852957",
            "twint_phone": None,
            "phone": None,
            "vat_number": None,
            "default_vat_rate": "0.081",
            "payment_terms_days": 30,
            "reminder_terms_days": 10,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text


@pytest.fixture
async def customer_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    resp = await client.post(
        "/customers",
        json={
            "first_name": "Jean",
            "last_name": "Dupont",
            "address_line1": "Rue de la Gare 1",
            "postal_code": "1110",
            "city": "Morges",
            "country": "CH",
            "email": "jean@test.ch",
            "phones": [],
        },
        headers=auth_headers,
    )
    return str(resp.json()["id"])


@pytest.fixture
async def other_headers(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict[str, str]
) -> dict[str, str]:
    """A second tenant, to check that one tenant never reaches another's data."""
    return await signed_in(
        client, db_session, name="Other", subdomain="other", email="other@test.ch"
    )


@pytest.fixture
async def article_id(client: AsyncClient, auth_headers: dict[str, str]) -> str:
    """An article with 10 in stock, at CHF 28.00."""
    resp = await client.post(
        "/articles",
        json={
            "name": "Pinot Noir",
            "description": "AOC Vaud",
            "unit_price": "28.00",
            "vat_rate_override": None,
            "stock_quantity": 10,
        },
        headers=auth_headers,
    )
    return str(resp.json()["id"])


MakeInvoice = Callable[..., Awaitable[dict[str, Any]]]


@pytest.fixture
def make_invoice(
    client: AsyncClient, auth_headers: dict[str, str], customer_id: str
) -> MakeInvoice:
    """Create an invoice for the customer, then walk it through ``steps`` (issue, pay, cancel).

    ``lines`` defaults to one free-text line of 2 × CHF 50.00, without VAT.
    Returns the invoice as the API last returned it.
    """

    async def make(
        *steps: str, lines: list[dict[str, Any]] | None = None, **fields: Any
    ) -> dict[str, Any]:
        resp = await client.post(
            "/invoices",
            json={
                "customer_id": customer_id,
                "lines": lines
                if lines is not None
                else [
                    {
                        "article_id": None,
                        "description_snapshot": "Service A",
                        "quantity": 2,
                        "unit_price_snapshot": "50.00",
                        "vat_rate_snapshot": None,
                    }
                ],
                **fields,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        invoice: dict[str, Any] = resp.json()
        for step in steps:
            resp = await client.post(f"/invoices/{invoice['id']}/{step}", headers=auth_headers)
            assert resp.status_code == 200, f"{step}: {resp.text}"
            invoice = resp.json()
        return invoice

    return make
