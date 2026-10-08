import csv
import io

from fastapi.testclient import TestClient

ARTICLES = "/articles"
WITHDRAWALS = "/stock-withdrawals"

ARTICLE_PAYLOAD = {
    "name": "Pinot Noir",
    "description": "AOC Vaud",
    "unit_price": "28.00",
    "vat_rate_override": None,
    "stock_quantity": 10,
}


def _article(client: TestClient, headers: dict[str, str], name: str = "Pinot Noir") -> str:
    resp = client.post(ARTICLES, json={**ARTICLE_PAYLOAD, "name": name}, headers=headers)
    return str(resp.json()["id"])


def _withdraw(
    client: TestClient,
    headers: dict[str, str],
    article_id: str,
    quantity: int,
    reason: str = "tasting",
    on: str = "2026-05-12",
) -> str:
    resp = client.post(
        WITHDRAWALS,
        json={
            "article_id": article_id,
            "date": on,
            "quantity": quantity,
            "reason": reason,
            "note": "Salon des vins",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return str(resp.json()["id"])


def _stock(client: TestClient, headers: dict[str, str], article_id: str) -> int:
    items = client.get(ARTICLES, headers=headers).json()["items"]
    return int(next(a["stock_quantity"] for a in items if a["id"] == article_id))


def test_withdrawal_takes_stock_and_delete_gives_it_back(
    client: TestClient, auth_headers: dict[str, str]
):
    article_id = _article(client, auth_headers)

    withdrawal_id = _withdraw(client, auth_headers, article_id, 3)
    assert _stock(client, auth_headers, article_id) == 7

    data = client.get(WITHDRAWALS, headers=auth_headers).json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item == {
        "id": withdrawal_id,
        "article_id": article_id,
        "article_name": "Pinot Noir",
        "date": "2026-05-12",
        "quantity": 3,
        "reason": "tasting",
        "note": "Salon des vins",
        "invoice_id": None,
        "invoice_number": None,
    }

    resp = client.delete(f"{WITHDRAWALS}/{withdrawal_id}", headers=auth_headers)
    assert resp.status_code == 204
    assert _stock(client, auth_headers, article_id) == 10
    assert client.get(WITHDRAWALS, headers=auth_headers).json()["total"] == 0


def test_withdrawal_validation(client: TestClient, auth_headers: dict[str, str]):
    article_id = _article(client, auth_headers)
    payload = {"article_id": article_id, "date": "2026-05-12", "quantity": 1, "reason": "loss"}

    for invalid in ({"quantity": 0}, {"reason": "theft"}, {"note": "x" * 501}):
        resp = client.post(WITHDRAWALS, json={**payload, **invalid}, headers=auth_headers)
        assert resp.status_code == 422, invalid
    assert _stock(client, auth_headers, article_id) == 10


def test_withdrawal_tenant_isolation(
    client: TestClient, auth_headers: dict[str, str], other_headers: dict[str, str]
):
    article_id = _article(client, auth_headers)
    withdrawal_id = _withdraw(client, auth_headers, article_id, 2)
    other = other_headers

    assert client.get(WITHDRAWALS, headers=other).json()["total"] == 0
    resp = client.post(
        WITHDRAWALS,
        json={
            "article_id": article_id,
            "date": "2026-05-12",
            "quantity": 1,
            "reason": "loss",
        },
        headers=other,
    )
    assert resp.status_code == 404
    assert client.delete(f"{WITHDRAWALS}/{withdrawal_id}", headers=other).status_code == 404
    assert _stock(client, auth_headers, article_id) == 8


def test_list_withdrawals_filters_and_sort(client: TestClient, auth_headers: dict[str, str]):
    pinot = _article(client, auth_headers)
    chasselas = _article(client, auth_headers, "Chasselas")
    _withdraw(client, auth_headers, pinot, 1, "tasting", "2026-03-01")
    _withdraw(client, auth_headers, chasselas, 6, "loss", "2026-04-01")
    _withdraw(client, auth_headers, pinot, 2, "promotion", "2026-02-01")

    def quantities(query: str = "") -> list[int]:
        data = client.get(f"{WITHDRAWALS}?{query}", headers=auth_headers).json()
        return [int(i["quantity"]) for i in data["items"]]

    assert quantities() == [6, 1, 2]  # most recent first
    assert quantities("reason=loss") == [6]
    assert quantities(f"article_id={pinot}") == [1, 2]
    assert quantities("search=chass") == [6]
    assert quantities("sort=quantity&order=asc") == [1, 2, 6]
    by_article = client.get(f"{WITHDRAWALS}?sort=article&order=desc", headers=auth_headers).json()
    assert [i["article_name"] for i in by_article["items"]] == [
        "Pinot Noir",
        "Pinot Noir",
        "Chasselas",
    ]


def test_articles_report_withdrawn_quantity_by_period(
    client: TestClient, auth_headers: dict[str, str]
):
    article_id = _article(client, auth_headers)
    _withdraw(client, auth_headers, article_id, 1, on="2025-03-31")
    _withdraw(client, auth_headers, article_id, 2, on="2025-04-01")
    _withdraw(client, auth_headers, article_id, 4, on="2026-01-15")

    def withdrawn(query: str = "") -> int:
        data = client.get(f"{ARTICLES}?{query}", headers=auth_headers).json()
        return int(data["items"][0]["withdrawn_quantity"])

    assert withdrawn() == 7
    assert withdrawn("sales_year=2025") == 3
    assert withdrawn("sales_year=2025&sales_quarter=2") == 2
    assert withdrawn("sales_year=2026") == 4
    # Withdrawals are not sales.
    data = client.get(ARTICLES, headers=auth_headers).json()
    assert data["items"][0]["sold_quantity"] == 0


def test_export_articles_csv_for_the_period(client: TestClient, auth_headers: dict[str, str]):
    pinot = _article(client, auth_headers)
    chasselas = _article(client, auth_headers, "Chasselas")
    _withdraw(client, auth_headers, pinot, 2, on="2025-05-12")
    _withdraw(client, auth_headers, pinot, 1, on="2025-11-02")
    client.patch(f"{ARTICLES}/{chasselas}/archive", headers=auth_headers)

    resp = client.get(
        f"{ARTICLES}/export.csv",
        params={"sales_year": 2025, "sales_quarter": 2},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "articles-2025-Q2.csv" in resp.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(resp.text)))
    assert rows[0] == [
        "name",
        "description",
        "unit_price",
        "vat_rate",
        "stock_quantity",
        "sold_quantity",
        "withdrawn_quantity",
    ]
    # Only the active articles, as listed by default.
    assert [(r[0], r[4], r[6]) for r in rows[1:]] == [("Pinot Noir", "7", "2")]

    all_time = client.get(f"{ARTICLES}/export.csv", headers=auth_headers)
    assert 'filename="articles.csv"' in all_time.headers["content-disposition"]
    assert list(csv.reader(io.StringIO(all_time.text)))[1][6] == "3"

    archived = client.get(f"{ARTICLES}/export.csv?archived=true", headers=auth_headers)
    assert 'filename="articles-archived.csv"' in archived.headers["content-disposition"]
    assert [r[0] for r in list(csv.reader(io.StringIO(archived.text)))[1:]] == ["Chasselas"]

    bad = client.get(f"{ARTICLES}/export.csv?sales_quarter=1", headers=auth_headers)
    assert bad.status_code == 422


def test_article_search_ignores_accents(client: TestClient, auth_headers: dict[str, str]):
    chateau = _article(client, auth_headers, "Château Margaux")
    _article(client, auth_headers, "Chasselas")
    _withdraw(client, auth_headers, chateau, 1)

    found = client.get(ARTICLES, params={"search": "chateau"}, headers=auth_headers).json()
    assert [a["name"] for a in found["items"]] == ["Château Margaux"]
    withdrawals = client.get(
        WITHDRAWALS, params={"search": "margaux chât"}, headers=auth_headers
    ).json()
    assert withdrawals["total"] == 1
