from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import MakeInvoice
from tests.test_invoices import _pdf_text

WITHDRAWALS = "/stock-withdrawals"


def _lines(article_id: str, sold: int = 12, offered: int = 1) -> list[dict[str, Any]]:
    return [
        {
            "article_id": article_id,
            "description_snapshot": "Pinot Noir",
            "quantity": sold,
            "unit_price_snapshot": "25.00",
            "vat_rate_snapshot": "0.081",
        },
        {
            "article_id": article_id,
            "description_snapshot": "Pinot Noir",
            "quantity": offered,
            "unit_price_snapshot": "0",
            "vat_rate_snapshot": None,
            "offered": True,
        },
    ]


def _article(client: TestClient, headers: dict[str, str], article_id: str) -> dict[str, Any]:
    items = client.get("/articles", headers=headers).json()["items"]
    return next(a for a in items if a["id"] == article_id)


@pytest.mark.usefixtures("complete_profile")
def test_issuing_gives_the_offered_articles_away_as_a_promotion(
    client: TestClient, auth_headers: dict[str, str], article_id: str, make_invoice: MakeInvoice
):
    invoice = make_invoice("issue", lines=_lines(article_id, sold=6, offered=1))

    article = _article(client, auth_headers, article_id)
    assert article["stock_quantity"] == 3  # 10 - 6 sold - 1 offered
    assert article["sold_quantity"] == 6
    assert article["withdrawn_quantity"] == 1

    [withdrawal] = client.get(WITHDRAWALS, headers=auth_headers).json()["items"]
    assert withdrawal["reason"] == "promotion"
    assert withdrawal["quantity"] == 1
    assert withdrawal["date"] == invoice["issue_date"]
    assert withdrawal["invoice_id"] == invoice["id"]
    assert withdrawal["invoice_number"] == invoice["invoice_number"]

    # Only the invoice removes it: the PDF still prints the article as offered.
    resp = client.delete(f"{WITHDRAWALS}/{withdrawal['id']}", headers=auth_headers)
    assert resp.status_code == 409
    assert _article(client, auth_headers, article_id)["stock_quantity"] == 3


@pytest.mark.usefixtures("complete_profile")
def test_cancelling_takes_the_withdrawal_back(
    client: TestClient, auth_headers: dict[str, str], article_id: str, make_invoice: MakeInvoice
):
    make_invoice("issue", "cancel", lines=_lines(article_id, sold=6, offered=1))

    article = _article(client, auth_headers, article_id)
    assert article["stock_quantity"] == 10
    assert article["withdrawn_quantity"] == 0
    assert client.get(WITHDRAWALS, headers=auth_headers).json()["items"] == []


def test_a_draft_withdraws_nothing(
    client: TestClient, auth_headers: dict[str, str], article_id: str, make_invoice: MakeInvoice
):
    invoice = make_invoice(lines=_lines(article_id))
    assert [line["offered"] for line in invoice["lines"]] == [False, True]
    assert client.get(WITHDRAWALS, headers=auth_headers).json()["items"] == []
    assert _article(client, auth_headers, article_id)["stock_quantity"] == 10


@pytest.mark.parametrize(
    "change",
    [
        {"article_id": None},
        {"unit_price_snapshot": "5.00"},
        {"vat_rate_snapshot": "0.081"},
    ],
    ids=["free text", "a price", "VAT"],
)
def test_an_offered_line_is_an_article_for_nothing(
    client: TestClient,
    auth_headers: dict[str, str],
    customer_id: str,
    article_id: str,
    change: dict[str, Any],
):
    sold, offered = _lines(article_id)
    resp = client.post(
        "/invoices",
        json={"customer_id": customer_id, "lines": [sold, {**offered, **change}]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.usefixtures("complete_profile")
def test_pdf_prints_the_offered_line_at_zero(
    client: TestClient, auth_headers: dict[str, str], article_id: str, make_invoice: MakeInvoice
):
    invoice = make_invoice("issue", lines=_lines(article_id, sold=12, offered=1))
    url = f"/invoices/{invoice['id']}/pdf"

    text = _pdf_text(client.get(url, headers=auth_headers).content)
    assert r"(Pinot Noir \(offert\))" in text  # parentheses are escaped in a PDF
    # The total is the 12 sold: 300.00 + 8.1 % VAT, no VAT row for the gift.
    assert "324.30" in text
    english = _pdf_text(client.get(f"{url}?lang=en", headers=auth_headers).content)
    assert r"(Pinot Noir \(free\))" in english
