"""Generate demo.json with ~100 customers and 1-10 invoices each."""

from __future__ import annotations

import json
import random
from pathlib import Path

random.seed(42)

FIRST_NAMES = [
    "Alice", "Marc", "Sophie", "Jean-Pierre", "Isabelle", "Thomas", "Claire",
    "Nicolas", "Céline", "François", "Nathalie", "Pierre", "Anne-Marie", "David",
    "Sylvie", "Laurent", "Valérie", "Michel", "Christine", "Patrick", "Muriel",
    "Philippe", "Sandrine", "Yves", "Martine", "Olivier", "Véronique", "Frédéric",
    "Brigitte", "Sébastien", "Catherine", "Christophe", "Monique", "Daniel",
    "Dominique", "Vincent", "Hélène", "Stéphane", "Agnès", "Thierry", "Lucie",
    "Benoît", "Julie", "Henri", "Simone", "Romain", "Émilie", "Guy", "Pauline",
    "Gilles", "Fabienne", "Bertrand", "Nadia", "Arnaud", "Irène", "Luc", "Audrey",
    "Serge", "Corinne", "Alain", "Delphine", "Bruno", "Jeanne", "Eric", "Florence",
    "Roland", "Mireille", "Christian", "Laure", "Antoine", "Geneviève", "Pascal",
    "Michèle", "Xavier", "Annick", "Denis", "Élise", "Paul", "Mathilde", "Didier",
    "Renée", "Julien", "Angèle", "Robert", "Charlotte", "Loïc", "Joëlle",
    "Raphaël", "Estelle", "Gérard", "Inès", "Florian", "Odile", "Charles", "Léa",
    "Maxime", "Suzanne", "Hugo", "Camille",
]

LAST_NAMES = [
    "Dupont", "Martin", "Müller", "Rochat", "Favre", "Morel", "Bernard", "Simon",
    "Perret", "Blanc", "Bonvin", "Girard", "Chevalier", "Rossier", "Lecomte",
    "Dubois", "Roux", "Schmid", "Weber", "Brunner", "Mayer", "Huber", "Fischer",
    "Zimmermann", "Graf", "Keller", "Bauer", "Bachmann", "Steiner", "Meier",
    "Meyer", "Frei", "Gerber", "Schneider", "Lehmann", "Koch", "Hofmann",
    "Burri", "Käser", "Wenger", "Stalder", "Bernet", "Egli", "Lüthi", "Burkhard",
    "Kälin", "Suter", "Mathys", "Nussbaum", "Stöckli", "Moser", "Gasser",
    "Ammann", "Küng", "Fluri", "Zaugg", "Baumann", "Renaud", "Gaillard",
    "Aubry", "Perrin", "Picard", "Mercier", "Leroy", "Moreau", "Laurent",
    "Fournier", "Rousseau", "Bertrand", "Carpentier", "Masson", "Chevalier",
    "Arnaud", "Garnier", "Lemaire", "Maillard", "Fontaine", "Barbier",
    "Marchand", "Boucher", "Perez", "Robert", "Richard", "Bonnet", "Henry",
    "Charpentier", "Colin", "Vidal", "Guérin", "Conte", "Brun", "Benoit",
    "Moulin", "Laroche", "Gauthier", "Roy", "Nicolas", "Petit", "Adam",
    "Breton", "Lenoir", "Girault",
]

SWISS_CITIES = [
    ("1000", "Lausanne"), ("1003", "Lausanne"), ("1004", "Lausanne"),
    ("1007", "Lausanne"), ("1200", "Genève"), ("1201", "Genève"),
    ("1202", "Genève"), ("1205", "Genève"), ("1400", "Yverdon-les-Bains"),
    ("1800", "Vevey"), ("1820", "Montreux"), ("2000", "Neuchâtel"),
    ("2500", "Bienne"), ("2502", "Bienne"), ("3000", "Berne"),
    ("3001", "Berne"), ("3005", "Berne"), ("3011", "Berne"),
    ("3600", "Thoune"), ("4000", "Bâle"), ("4001", "Bâle"),
    ("4051", "Bâle"), ("4052", "Bâle"), ("4500", "Soleure"),
    ("5000", "Aarau"), ("5001", "Aarau"), ("6000", "Lucerne"),
    ("6003", "Lucerne"), ("6300", "Zug"), ("6900", "Lugano"),
    ("6901", "Lugano"), ("7000", "Coire"), ("8000", "Zurich"),
    ("8001", "Zurich"), ("8002", "Zurich"), ("8003", "Zurich"),
    ("8005", "Zurich"), ("8006", "Zurich"), ("8032", "Zurich"),
    ("8400", "Winterthour"), ("8500", "Frauenfeld"), ("9000", "Saint-Gall"),
    ("9001", "Saint-Gall"),
]

STREETS = [
    "Rue du Lac", "Rue de Berne", "Rue du Simplon", "Avenue de la Gare",
    "Route de Genève", "Chemin des Vignes", "Rue de l'Église", "Grand-Rue",
    "Rue du Marché", "Boulevard de Pérolles", "Bahnhofstrasse",
    "Hauptstrasse", "Kirchgasse", "Dorfstrasse", "Marktgasse",
    "Seestrasse", "Gartenstrasse", "Bergstrasse", "Waldweg",
    "Römerstrasse", "Lindenstrasse", "Birkenweg", "Mühlegasse",
    "Rue de la Paix", "Rue du Rhône", "Rue de Rive", "Allée des Acacias",
    "Place du Molard", "Rue des Eaux-Vives", "Avenue de la Jonction",
]

ARTICLES = [
    "Pinot Noir Vieilles Vignes 2021",
    "Chasselas Tradition 2023",
    "Assemblage Rouge Prestige 2020",
    "Rosé de Gamay 2023",
    "Caisse bois 6 bouteilles",
]

STATUSES = ["draft", "issued", "paid", "cancelled"]
STATUS_WEIGHTS = [0.25, 0.30, 0.35, 0.10]


def _customer(index: int) -> dict:
    first = FIRST_NAMES[index % len(FIRST_NAMES)]
    last = LAST_NAMES[(index * 7 + 3) % len(LAST_NAMES)]
    postal, city = SWISS_CITIES[index % len(SWISS_CITIES)]
    street = STREETS[index % len(STREETS)]
    number = (index % 30) + 1
    has_email = index % 5 != 0
    has_phone = index % 3 != 0
    phones = []
    if has_phone:
        labels = ["Mobile", "Bureau", "Domicile"]
        label = labels[index % len(labels)]
        n1 = 70 + (index % 9)
        n2 = 100 + (index % 900)
        n3 = 10 + (index % 90)
        n4 = 10 + (index % 90)
        phones = [{"label": label, "number": f"+41 {n1} {n2:03d} {n3:02d} {n4:02d}"}]
    return {
        "first_name": first,
        "last_name": last,
        "email": f"{first.lower().replace('-', '').replace('é','e').replace('è','e').replace('ê','e').replace('â','a').replace('î','i').replace('ô','o').replace('û','u').replace('ç','c')}.{last.lower().replace('-', '').replace('é','e').replace('è','e').replace('ê','e').replace('â','a').replace('î','i').replace('ô','o').replace('û','u').replace('ç','c')}@example.ch" if has_email else None,
        "address_line1": f"{street} {number}",
        "postal_code": postal,
        "city": city,
        "country": "CH",
        "phones": phones,
    }


def _invoice(customer_email: str | None, index: int, inv_index: int) -> dict:
    status = random.choices(STATUSES, STATUS_WEIGHTS)[0]
    n_lines = random.randint(1, 4)
    articles_sample = random.sample(ARTICLES, min(n_lines, len(ARTICLES)))
    lines = [
        {
            "article_name": art,
            "quantity": random.choice([1, 2, 3, 6, 12, 24]),
        }
        for art in articles_sample
    ]
    discount = random.choice([0, 0, 0, 5, 10])
    inv: dict = {
        "customer_email": customer_email,
        "status": status,
        "currency": "CHF",
        "discount_percent": discount,
        "notes": "",
        "lines": lines,
    }
    if status in ("issued", "paid", "cancelled"):
        year = 2026 if inv_index % 3 != 2 else 2025
        month = 1 + (inv_index % 6)
        day = 1 + (inv_index % 28)
        inv["invoice_number"] = f"FAC-{year}-{index + inv_index * 100 + 1:04d}"
        inv["issue_date"] = f"{year}-{month:02d}-{day:02d}"
        if month < 12:
            inv["due_date"] = f"{year}-{month + 1:02d}-{day:02d}"
        else:
            inv["due_date"] = f"{year + 1}-01-{day:02d}"
    return inv


def main() -> None:
    customers = [_customer(i) for i in range(100)]

    invoices = []
    for i, c in enumerate(customers):
        n = random.randint(1, 10)
        for j in range(n):
            email = c["email"]
            if email is None:
                continue
            invoices.append(_invoice(email, i, j))

    fixture = {
        "tenant": {
            "name": "Cave du Lac",
            "subdomain": "cave-du-lac",
            "admin_email": "admin@cave.ch",
            "admin_password": "secret123",
            "profile": {
                "company_name": "Cave du Lac Sàrl",
                "address_line1": "Route du Vignoble 12",
                "postal_code": "1400",
                "city": "Yverdon-les-Bains",
                "country": "CH",
                "iban": "CH56 0483 5012 3456 7800 9",
                "vat_number": "CHE-123.456.789 TVA",
                "default_vat_rate": 0.081,
                "invoice_prefix": "FAC",
                "invoice_next_number": 1,
                "payment_terms_days": 30,
            },
        },
        "articles": [
            {
                "name": "Pinot Noir Vieilles Vignes 2021",
                "description": "Élevé en barrique 12 mois, notes de cerise noire et d'épices",
                "unit_price": 24.50,
                "vat_rate_override": None,
                "stock_quantity": 120,
            },
            {
                "name": "Chasselas Tradition 2023",
                "description": "Fraîcheur et minéralité, idéal à l'apéritif",
                "unit_price": 12.00,
                "vat_rate_override": None,
                "stock_quantity": 240,
            },
            {
                "name": "Assemblage Rouge Prestige 2020",
                "description": "Merlot 60% / Cabernet Franc 40%, garde 5 ans",
                "unit_price": 38.00,
                "vat_rate_override": None,
                "stock_quantity": 60,
            },
            {
                "name": "Rosé de Gamay 2023",
                "description": "Robe saumonée, arômes de fraise et framboise",
                "unit_price": 14.50,
                "vat_rate_override": None,
                "stock_quantity": 180,
            },
            {
                "name": "Caisse bois 6 bouteilles",
                "description": "Caisse en bois avec gravure personnalisable",
                "unit_price": 18.00,
                "vat_rate_override": 0.081,
                "stock_quantity": 50,
            },
        ],
        "customers": customers,
        "invoices": invoices,
    }

    out = Path(__file__).parent / "demo.json"
    out.write_text(json.dumps(fixture, indent=2, ensure_ascii=False))
    n_inv = len([inv for inv in invoices if inv.get("customer_email")])
    print(f"Generated {len(customers)} customers, {n_inv} invoices → {out}")


if __name__ == "__main__":
    main()
