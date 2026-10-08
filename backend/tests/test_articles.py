from datetime import date, datetime
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.invoice import Invoice
from tests.conftest import MakeInvoice

ARTICLES = "/articles"


ARTICLE_PAYLOAD = {
    "name": "Pinot Noir",
    "description": "AOC Vaud",
    "unit_price": "28.00",
    "vat_rate_override": None,
    "stock_quantity": 10,
}


@pytest.mark.parametrize("change", [{"unit_price": "-1.00"}, {"vat_rate_override": "1.2"}])
def test_article_price_and_vat_are_bounded(
    client: TestClient, auth_headers: dict[str, str], change: dict[str, str]
):
    resp = client.post(ARTICLES, json=ARTICLE_PAYLOAD | change, headers=auth_headers)
    assert resp.status_code == 422


def test_create_article(client: TestClient, auth_headers: dict[str, str]):
    resp = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Pinot Noir"
    assert data["is_archived"] is False
    assert "id" in data


def test_list_articles(client: TestClient, auth_headers: dict[str, str]):
    client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    resp = client.get(ARTICLES, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


def test_list_articles_newest_first(
    client: TestClient, auth_headers: dict[str, str], db_session: Session
):
    older = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    newer = client.post(
        ARTICLES,
        json={**ARTICLE_PAYLOAD, "name": "Nouveau Pinot"},
        headers=auth_headers,
    )
    db_session.execute(
        update(Article)
        .where(Article.id == UUID(older.json()["id"]))
        .values(created_at=datetime(2020, 1, 1))
    )
    db_session.execute(
        update(Article)
        .where(Article.id == UUID(newer.json()["id"]))
        .values(created_at=datetime(2025, 1, 1))
    )
    db_session.commit()

    response = client.get(ARTICLES, headers=auth_headers)

    assert [article["id"] for article in response.json()["items"]] == [
        newer.json()["id"],
        older.json()["id"],
    ]


def test_update_article(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    resp = client.put(
        f"{ARTICLES}/{article_id}",
        json={**ARTICLE_PAYLOAD, "name": "Chardonnay"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Chardonnay"


def test_archive_article(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    client.patch(f"{ARTICLES}/{article_id}/archive", headers=auth_headers)
    resp = client.get(ARTICLES, headers=auth_headers)
    assert all(a["id"] != article_id for a in resp.json()["items"])


def test_article_search(client: TestClient, auth_headers: dict[str, str]):
    client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    client.post(ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chardonnay"}, headers=auth_headers)
    resp = client.get(f"{ARTICLES}?search=pinot", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Pinot Noir"


def test_article_tenant_isolation(
    client: TestClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    article_id = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers).json()["id"]

    resp = client.get(ARTICLES, headers=other_headers)
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
            f"{ARTICLES}/{article_id}{path}",
            headers=other_headers,
            json=ARTICLE_PAYLOAD if method == "PUT" else None,
        )
        assert resp.status_code == 404, (method, path)


def test_list_archived_and_restore_article(client: TestClient, auth_headers: dict[str, str]):
    create = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers)
    article_id = create.json()["id"]
    client.patch(f"{ARTICLES}/{article_id}/archive", headers=auth_headers)

    archived = client.get(f"{ARTICLES}?archived=true", headers=auth_headers).json()
    assert [x["id"] for x in archived["items"]] == [article_id]
    assert archived["total"] == 1

    resp = client.patch(f"{ARTICLES}/{article_id}/restore", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False
    active = client.get(ARTICLES, headers=auth_headers).json()
    assert [x["id"] for x in active["items"]] == [article_id]
    archived = client.get(f"{ARTICLES}?archived=true", headers=auth_headers).json()
    assert archived["items"] == []


# The steps that bring an invoice to each status, from a draft.
STEPS = {
    "draft": (),
    "issued": ("issue",),
    "paid": ("issue", "pay"),
    "cancelled": ("issue", "cancel"),
}


def _sell(make_invoice: MakeInvoice, article_id: str, quantity: int, status: str) -> str:
    invoice = make_invoice(
        *STEPS[status],
        lines=[
            {
                "article_id": article_id,
                "description_snapshot": "Pinot Noir",
                "quantity": quantity,
                "unit_price_snapshot": "28.00",
                "vat_rate_snapshot": None,
            }
        ],
    )
    return str(invoice["id"])


def test_sold_quantity_counts_issued_and_paid_invoices_only(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: Session,
    make_invoice: MakeInvoice,
):
    article_id = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers).json()["id"]
    unsold_id = client.post(
        ARTICLES, json={**ARTICLE_PAYLOAD, "name": "Chasselas"}, headers=auth_headers
    ).json()["id"]
    this_year = date.today().year
    _sell(make_invoice, article_id, 3, "issued")
    last_year = _sell(make_invoice, article_id, 4, "paid")
    _sell(make_invoice, article_id, 5, "draft")
    _sell(make_invoice, article_id, 7, "cancelled")
    db_session.execute(
        update(Invoice)
        .where(Invoice.id == UUID(last_year))
        .values(issue_date=date(this_year - 1, 6, 1))
    )
    db_session.commit()

    def sold(data: dict[str, Any]) -> dict[str, int]:
        return {a["id"]: a["sold_quantity"] for a in data["items"]}

    all_time = client.get(ARTICLES, headers=auth_headers).json()
    assert sold(all_time) == {article_id: 7, unsold_id: 0}
    previous = client.get(f"{ARTICLES}?sales_year={this_year - 1}", headers=auth_headers).json()
    assert sold(previous) == {article_id: 4, unsold_id: 0}
    current = client.get(f"{ARTICLES}?sales_year={this_year}", headers=auth_headers).json()
    assert sold(current) == {article_id: 3, unsold_id: 0}

    years = client.get(f"{ARTICLES}/sales-years", headers=auth_headers).json()
    assert years == [this_year, this_year - 1]


def test_sold_quantity_by_quarter(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    db_session: Session,
    make_invoice: MakeInvoice,
):
    article_id = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers).json()["id"]
    # Quarter boundaries: 31 March is Q1, 1 April Q2, 31 December Q4.
    for quantity, issue_date in [
        (1, date(2025, 3, 31)),
        (2, date(2025, 4, 1)),
        (4, date(2025, 12, 31)),
    ]:
        invoice_id = _sell(make_invoice, article_id, quantity, "issued")
        db_session.execute(
            update(Invoice).where(Invoice.id == UUID(invoice_id)).values(issue_date=issue_date)
        )
    db_session.commit()

    def sold(query: str) -> int:
        resp = client.get(f"{ARTICLES}?{query}", headers=auth_headers)
        return int(resp.json()["items"][0]["sold_quantity"])

    assert [sold(f"sales_year=2025&sales_quarter={q}") for q in (1, 2, 3, 4)] == [1, 2, 0, 4]
    assert sold("sales_year=2025") == 7

    resp = client.get(f"{ARTICLES}?sales_quarter=1", headers=auth_headers)
    assert resp.status_code == 422


def test_sort_articles(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    complete_profile: None,
    make_invoice: MakeInvoice,
):
    ids = {}
    for name, price, vat in [
        ("beta", "30.00", "0.026"),
        ("Alpha", "10.00", None),
        ("gamma", "20.00", "0.081"),
    ]:
        resp = client.post(
            ARTICLES,
            json={
                **ARTICLE_PAYLOAD,
                "name": name,
                "unit_price": price,
                "vat_rate_override": vat,
            },
            headers=auth_headers,
        )
        ids[name] = resp.json()["id"]
    _sell(make_invoice, ids["gamma"], 5, "issued")
    _sell(make_invoice, ids["beta"], 2, "issued")

    def names(query: str) -> list[str]:
        resp = client.get(f"{ARTICLES}?{query}", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        return [a["name"] for a in resp.json()["items"]]

    # Case-insensitive, unlike SQLite's default binary collation.
    assert names("sort=name") == ["Alpha", "beta", "gamma"]
    assert names("sort=name&order=desc") == ["gamma", "beta", "Alpha"]
    assert names("sort=unit_price&order=desc") == ["beta", "gamma", "Alpha"]
    assert names("sort=sold_quantity&order=desc") == ["gamma", "beta", "Alpha"]
    # No override stays last in both directions.
    assert names("sort=vat_rate_override") == ["beta", "gamma", "Alpha"]
    assert names("sort=vat_rate_override&order=desc") == ["gamma", "beta", "Alpha"]

    assert client.get(f"{ARTICLES}?sort=tenant_id", headers=auth_headers).status_code == 422


def test_get_article(client: TestClient, auth_headers: dict[str, str]):
    article_id = client.post(ARTICLES, json=ARTICLE_PAYLOAD, headers=auth_headers).json()["id"]
    resp = client.get(f"{ARTICLES}/{article_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Pinot Noir"
    other = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"{ARTICLES}/{other}", headers=auth_headers).status_code == 404
