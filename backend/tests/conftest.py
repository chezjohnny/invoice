from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, configure_sqlite_connection, get_db
from app.main import app
from app.services.tenants import create_tenant


@pytest.fixture
def db_session():
    # One in-memory database for the test and the threads the app runs routes in.
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    event.listen(engine, "connect", configure_sqlite_connection)
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


PASSWORD = "secret123"


def signed_in(
    client: TestClient, db: Session, *, name: str, subdomain: str, email: str
) -> dict[str, str]:
    """A new tenant, as the CLI creates it, then its admin's login headers."""
    create_tenant(db, name=name, subdomain=subdomain, email=email, password=PASSWORD)
    db.commit()
    resp = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def auth_headers(client: TestClient, db_session: Session) -> dict[str, str]:
    return signed_in(
        client, db_session, name="Cave Test", subdomain="cave-test", email="cave@test.ch"
    )


@pytest.fixture
def complete_profile(client: TestClient, auth_headers: dict[str, str]) -> None:
    """Fill the company profile so invoices can be issued (address + IBAN required)."""
    resp = client.put(
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
def customer_id(client: TestClient, auth_headers: dict[str, str]) -> str:
    resp = client.post(
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
def other_headers(
    client: TestClient, db_session: Session, auth_headers: dict[str, str]
) -> dict[str, str]:
    """A second tenant, to check that one tenant never reaches another's data."""
    return signed_in(client, db_session, name="Other", subdomain="other", email="other@test.ch")


@pytest.fixture
def article_id(client: TestClient, auth_headers: dict[str, str]) -> str:
    """An article with 10 in stock, at CHF 28.00."""
    resp = client.post(
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


MakeInvoice = Callable[..., dict[str, Any]]


@pytest.fixture
def make_invoice(client: TestClient, auth_headers: dict[str, str], customer_id: str) -> MakeInvoice:
    """Create an invoice for the customer, then walk it through ``steps`` (issue, pay, cancel).

    ``lines`` defaults to one free-text line of 2 × CHF 50.00, without VAT.
    Returns the invoice as the API last returned it.
    """

    def make(
        *steps: str, lines: list[dict[str, Any]] | None = None, **fields: Any
    ) -> dict[str, Any]:
        resp = client.post(
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
            resp = client.post(f"/invoices/{invoice['id']}/{step}", headers=auth_headers)
            assert resp.status_code == 200, f"{step}: {resp.text}"
            invoice = resp.json()
        return invoice

    return make
