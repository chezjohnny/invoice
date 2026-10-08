import csv
import io
from datetime import datetime
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.customer import Customer

CUSTOMERS = "/customers"


CUSTOMER_PAYLOAD = {
    "first_name": "Jean",
    "last_name": "Dupont",
    "address_line1": "Rue de la Gare 12",
    "address_line2": "Case postale 34",
    "postal_code": "1110",
    "city": "Morges",
    "country": "CH",
    "email": "jean.dupont@example.ch",
    "phones": [{"label": "Mobile", "number": "+41 79 123 45 67"}],
}


def test_create_customer(client: TestClient, auth_headers: dict[str, str]):
    resp = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "Jean"
    assert data["last_name"] == "Dupont"
    assert data["address_line2"] == "Case postale 34"
    assert data["phones"] == [{"label": "Mobile", "number": "+41 79 123 45 67"}]
    assert data["is_archived"] is False


def test_customer_needs_a_last_name_only(client: TestClient, auth_headers: dict[str, str]):
    company = {**CUSTOMER_PAYLOAD, "last_name": "Garage du Lac SA"}
    del company["first_name"]
    resp = client.post(CUSTOMERS, json=company, headers=auth_headers)
    assert resp.status_code == 201
    assert resp.json()["first_name"] == ""

    blank = {**CUSTOMER_PAYLOAD, "last_name": "  "}
    resp = client.post(CUSTOMERS, json=blank, headers=auth_headers)
    assert resp.status_code == 422


def test_list_customers(client: TestClient, auth_headers: dict[str, str]):
    client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    resp = client.get(CUSTOMERS, headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


def test_list_customers_newest_first(
    client: TestClient, auth_headers: dict[str, str], db_session: Session
):
    older = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    newer = client.post(
        CUSTOMERS,
        json={**CUSTOMER_PAYLOAD, "email": "newer@example.ch"},
        headers=auth_headers,
    )
    db_session.execute(
        update(Customer)
        .where(Customer.id == UUID(older.json()["id"]))
        .values(created_at=datetime(2020, 1, 1))
    )
    db_session.execute(
        update(Customer)
        .where(Customer.id == UUID(newer.json()["id"]))
        .values(created_at=datetime(2025, 1, 1))
    )
    db_session.commit()

    response = client.get(CUSTOMERS, headers=auth_headers)

    assert [customer["id"] for customer in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


def test_update_customer(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    customer_id = create.json()["id"]
    resp = client.put(
        f"{CUSTOMERS}/{customer_id}",
        json={**CUSTOMER_PAYLOAD, "first_name": "Jacques"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Jacques"


def test_archive_customer(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    customer_id = create.json()["id"]
    client.patch(f"{CUSTOMERS}/{customer_id}/archive", headers=auth_headers)
    resp = client.get(CUSTOMERS, headers=auth_headers)
    assert all(c["id"] != customer_id for c in resp.json()["items"])


def test_export_csv(client: TestClient, auth_headers: dict[str, str]):
    client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    resp = client.get(f"{CUSTOMERS}/export.csv", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    lines = resp.text.strip().split("\n")
    assert lines[0].startswith("first_name,last_name,email,address_line1,address_line2,")
    assert "Case postale 34" in lines[1]


def test_customer_tenant_isolation(
    client: TestClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    customer_id = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers).json()["id"]

    resp = client.get(CUSTOMERS, headers=other_headers)
    assert resp.json()["total"] == 0
    assert resp.json()["items"] == []
    for method, path in [
        ("GET", ""),
        ("PUT", ""),
        ("PATCH", "/archive"),
        ("PATCH", "/restore"),
    ]:
        resp = client.request(
            method,
            f"{CUSTOMERS}/{customer_id}{path}",
            headers=other_headers,
            json=CUSTOMER_PAYLOAD if method == "PUT" else None,
        )
        assert resp.status_code == 404, (method, path)


def test_list_archived_and_restore_customer(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers)
    customer_id = create.json()["id"]
    client.patch(f"{CUSTOMERS}/{customer_id}/archive", headers=auth_headers)

    archived = client.get(f"{CUSTOMERS}?archived=true", headers=auth_headers).json()
    assert [x["id"] for x in archived["items"]] == [customer_id]
    assert archived["total"] == 1

    resp = client.patch(f"{CUSTOMERS}/{customer_id}/restore", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False
    active = client.get(CUSTOMERS, headers=auth_headers).json()
    assert [x["id"] for x in active["items"]] == [customer_id]
    archived = client.get(f"{CUSTOMERS}?archived=true", headers=auth_headers).json()
    assert archived["items"] == []


def test_sort_customers(client: TestClient, auth_headers: dict[str, str]):
    for first, last, email, city in [
        ("Luc", "favre", "luc@test.ch", "Rolle"),
        ("Anne", "Martin", None, "Aubonne"),
        ("Jean", "Dupont", "jean@test.ch", "Morges"),
    ]:
        client.post(
            CUSTOMERS,
            json={
                "first_name": first,
                "last_name": last,
                "address_line1": "Rue 1",
                "postal_code": "1110",
                "city": city,
                "country": "CH",
                "email": email,
                "phones": [],
            },
            headers=auth_headers,
        )

    def last_names(query: str) -> list[str]:
        resp = client.get(f"{CUSTOMERS}?{query}", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        return [c["last_name"] for c in resp.json()["items"]]

    assert last_names("sort=name") == ["Dupont", "favre", "Martin"]
    assert last_names("sort=city&order=desc") == ["favre", "Dupont", "Martin"]
    # A customer without an email stays last in both directions.
    assert last_names("sort=email") == ["Dupont", "favre", "Martin"]
    assert last_names("sort=email&order=desc") == ["favre", "Dupont", "Martin"]


def test_search_customers(client: TestClient, auth_headers: dict[str, str]):
    def create(first: str, last: str, phones: list[dict[str, str]]) -> None:
        resp = client.post(
            CUSTOMERS,
            json={
                **CUSTOMER_PAYLOAD,
                "first_name": first,
                "last_name": last,
                "email": None,
                "phones": phones,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text

    create("Hélène", "Dubois", [{"label": "Mobile", "number": "+41 79 123 45 67"}])
    create(
        "Jean",
        "Favre",
        [
            {"label": "Fixe", "number": "021 800 00 01"},
            {"label": "Mobile", "number": "078 555 66 77"},
        ],
    )
    create("Marc", "Rochat", [])

    def found(search: str) -> list[str]:
        resp = client.get(CUSTOMERS, params={"search": search}, headers=auth_headers)
        return sorted(c["last_name"] for c in resp.json()["items"])

    # A caller's number, however it is written, matches however it was stored.
    assert found("079 123 45 67") == ["Dubois"]
    assert found("+41791234567") == ["Dubois"]
    assert found("0041 79 123 45 67") == ["Dubois"]
    assert found("45 67") == ["Dubois"]
    assert found("078-555-66-77") == ["Favre"]  # the second number
    assert found("021 800") == ["Favre"]
    assert found("076 000 00 00") == []
    # Names: accents and case ignored, words in any order.
    assert found("helene") == ["Dubois"]
    assert found("favre jean") == ["Favre"]
    # Two digits are too few for a phone number: no phone search.
    assert found("79") == []


def test_get_customer(client: TestClient, auth_headers: dict[str, str]):
    customer_id = client.post(CUSTOMERS, json=CUSTOMER_PAYLOAD, headers=auth_headers).json()["id"]
    resp = client.get(f"{CUSTOMERS}/{customer_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["last_name"] == "Dupont"
    assert resp.json()["phones"] == CUSTOMER_PAYLOAD["phones"]
    missing = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"{CUSTOMERS}/{missing}", headers=auth_headers).status_code == 404


def test_export_csv_keeps_formulas_as_text(client: TestClient, auth_headers: dict[str, str]):
    client.post(
        CUSTOMERS,
        json={
            **CUSTOMER_PAYLOAD,
            "last_name": '=HYPERLINK("http://evil.example","x")',
            "first_name": "+41",
        },
        headers=auth_headers,
    )
    resp = client.get(f"{CUSTOMERS}/export.csv", headers=auth_headers)
    row = list(csv.reader(io.StringIO(resp.text)))[1]
    assert row[0] == "'+41"
    assert row[1] == '\'=HYPERLINK("http://evil.example","x")'
