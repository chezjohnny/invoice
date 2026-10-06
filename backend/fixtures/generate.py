"""Generate demo.json with ~100 customers and 1-10 invoices each."""

from __future__ import annotations

import json
import random
import re
from datetime import date, timedelta
from pathlib import Path

random.seed(42)
# Dates count back from the day of generation: regenerate to bring the demo up to date.
TODAY = date.today()

FIRST_NAMES = [
    "Alice",
    "Marc",
    "Sophie",
    "Jean-Pierre",
    "Isabelle",
    "Thomas",
    "Claire",
    "Nicolas",
    "Céline",
    "François",
    "Nathalie",
    "Pierre",
    "Anne-Marie",
    "David",
    "Sylvie",
    "Laurent",
    "Valérie",
    "Michel",
    "Christine",
    "Patrick",
    "Muriel",
    "Philippe",
    "Sandrine",
    "Yves",
    "Martine",
    "Olivier",
    "Véronique",
    "Frédéric",
    "Brigitte",
    "Sébastien",
    "Catherine",
    "Christophe",
    "Monique",
    "Daniel",
    "Dominique",
    "Vincent",
    "Hélène",
    "Stéphane",
    "Agnès",
    "Thierry",
    "Lucie",
    "Benoît",
    "Julie",
    "Henri",
    "Simone",
    "Romain",
    "Émilie",
    "Guy",
    "Pauline",
    "Gilles",
    "Fabienne",
    "Bertrand",
    "Nadia",
    "Arnaud",
    "Irène",
    "Luc",
    "Audrey",
    "Serge",
    "Corinne",
    "Alain",
    "Delphine",
    "Bruno",
    "Jeanne",
    "Eric",
    "Florence",
    "Roland",
    "Mireille",
    "Christian",
    "Laure",
    "Antoine",
    "Geneviève",
    "Pascal",
    "Michèle",
    "Xavier",
    "Annick",
    "Denis",
    "Élise",
    "Paul",
    "Mathilde",
    "Didier",
    "Renée",
    "Julien",
    "Angèle",
    "Robert",
    "Charlotte",
    "Loïc",
    "Joëlle",
    "Raphaël",
    "Estelle",
    "Gérard",
    "Inès",
    "Florian",
    "Odile",
    "Charles",
    "Léa",
    "Maxime",
    "Suzanne",
    "Hugo",
    "Camille",
]

LAST_NAMES = [
    "Dupont",
    "Martin",
    "Müller",
    "Rochat",
    "Favre",
    "Morel",
    "Bernard",
    "Simon",
    "Perret",
    "Blanc",
    "Bonvin",
    "Girard",
    "Chevalier",
    "Rossier",
    "Lecomte",
    "Dubois",
    "Roux",
    "Schmid",
    "Weber",
    "Brunner",
    "Mayer",
    "Huber",
    "Fischer",
    "Zimmermann",
    "Graf",
    "Keller",
    "Bauer",
    "Bachmann",
    "Steiner",
    "Meier",
    "Meyer",
    "Frei",
    "Gerber",
    "Schneider",
    "Lehmann",
    "Koch",
    "Hofmann",
    "Burri",
    "Käser",
    "Wenger",
    "Stalder",
    "Bernet",
    "Egli",
    "Lüthi",
    "Burkhard",
    "Kälin",
    "Suter",
    "Mathys",
    "Nussbaum",
    "Stöckli",
    "Moser",
    "Gasser",
    "Ammann",
    "Küng",
    "Fluri",
    "Zaugg",
    "Baumann",
    "Renaud",
    "Gaillard",
    "Aubry",
    "Perrin",
    "Picard",
    "Mercier",
    "Leroy",
    "Moreau",
    "Laurent",
    "Fournier",
    "Rousseau",
    "Bertrand",
    "Carpentier",
    "Masson",
    "Chevalier",
    "Arnaud",
    "Garnier",
    "Lemaire",
    "Maillard",
    "Fontaine",
    "Barbier",
    "Marchand",
    "Boucher",
    "Perez",
    "Robert",
    "Richard",
    "Bonnet",
    "Henry",
    "Charpentier",
    "Colin",
    "Vidal",
    "Guérin",
    "Conte",
    "Brun",
    "Benoit",
    "Moulin",
    "Laroche",
    "Gauthier",
    "Roy",
    "Nicolas",
    "Petit",
    "Adam",
    "Breton",
    "Lenoir",
    "Girault",
]

SWISS_CITIES = [
    ("1000", "Lausanne"),
    ("1003", "Lausanne"),
    ("1004", "Lausanne"),
    ("1007", "Lausanne"),
    ("1200", "Genève"),
    ("1201", "Genève"),
    ("1202", "Genève"),
    ("1205", "Genève"),
    ("1400", "Yverdon-les-Bains"),
    ("1800", "Vevey"),
    ("1820", "Montreux"),
    ("2000", "Neuchâtel"),
    ("2500", "Bienne"),
    ("2502", "Bienne"),
    ("3000", "Berne"),
    ("3001", "Berne"),
    ("3005", "Berne"),
    ("3011", "Berne"),
    ("3600", "Thoune"),
    ("4000", "Bâle"),
    ("4001", "Bâle"),
    ("4051", "Bâle"),
    ("4052", "Bâle"),
    ("4500", "Soleure"),
    ("5000", "Aarau"),
    ("5001", "Aarau"),
    ("6000", "Lucerne"),
    ("6003", "Lucerne"),
    ("6300", "Zug"),
    ("6900", "Lugano"),
    ("6901", "Lugano"),
    ("7000", "Coire"),
    ("8000", "Zurich"),
    ("8001", "Zurich"),
    ("8002", "Zurich"),
    ("8003", "Zurich"),
    ("8005", "Zurich"),
    ("8006", "Zurich"),
    ("8032", "Zurich"),
    ("8400", "Winterthour"),
    ("8500", "Frauenfeld"),
    ("9000", "Saint-Gall"),
    ("9001", "Saint-Gall"),
]

STREETS = [
    "Rue du Lac",
    "Rue de Berne",
    "Rue du Simplon",
    "Avenue de la Gare",
    "Route de Genève",
    "Chemin des Vignes",
    "Rue de l'Église",
    "Grand-Rue",
    "Rue du Marché",
    "Boulevard de Pérolles",
    "Bahnhofstrasse",
    "Hauptstrasse",
    "Kirchgasse",
    "Dorfstrasse",
    "Marktgasse",
    "Seestrasse",
    "Gartenstrasse",
    "Bergstrasse",
    "Waldweg",
    "Römerstrasse",
    "Lindenstrasse",
    "Birkenweg",
    "Mühlegasse",
    "Rue de la Paix",
    "Rue du Rhône",
    "Rue de Rive",
    "Allée des Acacias",
    "Place du Molard",
    "Rue des Eaux-Vives",
    "Avenue de la Jonction",
]

ARTICLES = [
    "Pinot Noir Vieilles Vignes 2021",
    "Chasselas Tradition 2023",
    "Assemblage Rouge Prestige 2020",
    "Rosé de Gamay 2023",
    "Caisse bois 6 bouteilles",
]

# Customers that are companies: named in last_name, without a first name.
COMPANIES = [
    "Restaurant du Lac SA",
    "Hôtel des Alpes",
    "Café de la Gare",
    "Cave Coopérative de Morges",
    "Boucherie Favre Sàrl",
    "Commune de Rolle",
    "Club de tennis de Nyon",
    "Garage du Léman SA",
    "Fondation Bois-Gentil",
    "Épicerie fine Perret",
]

EMAIL_CHARS = str.maketrans("éèêâîôûç", "eeeaiouc", "-")


def _email_part(name: str) -> str:
    return name.lower().translate(EMAIL_CHARS)


STATUSES = ["draft", "issued", "paid", "cancelled"]
STATUS_WEIGHTS = [0.25, 0.30, 0.35, 0.10]


def _customer(index: int) -> dict:
    customer = _person(index)
    if index % 10 == 4:
        company = COMPANIES[(index // 10) % len(COMPANIES)]
        slug = re.sub(r"[^a-z]+", "-", _email_part(company)).strip("-")
        customer |= {"first_name": "", "last_name": company, "email": f"contact@{slug}.ch"}
        if index % 20 == 4:
            # The contact person, as Swiss Post prints it above the street.
            contact = _person(index + 1)
            customer["address_line2"] = f"Par {contact['first_name']} {contact['last_name']}"
    elif index % 17 == 0:
        customer["address_line2"] = f"Case postale {100 + index}"
    if index % 25 == 24:
        customer["is_archived"] = True
    return customer


def _person(index: int) -> dict:
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
        "email": f"{_email_part(first)}.{_email_part(last)}@example.ch" if has_email else None,
        "address_line1": f"{street} {number}",
        "postal_code": postal,
        "city": city,
        "country": "CH",
        "phones": phones,
    }


# Invoice numbers already given per issue day, as the app numbers them.
_DAY_SEQUENCES: dict[str, int] = {}


def _invoice(customer_email: str | None) -> dict:
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
        "discount_percent": discount,
        "notes": "",
        "lines": lines,
    }
    if status in ("issued", "paid", "cancelled"):
        # Issued within the last 45 days, so that a third are overdue (30-day terms).
        issued = TODAY - timedelta(days=random.randint(0, 45 if status == "issued" else 365))
        due = issued + timedelta(days=30)
        # Same shape as the app's numbers: YYMMDD then the sequence of the day.
        stem = issued.strftime("%y%m%d")
        _DAY_SEQUENCES[stem] = _DAY_SEQUENCES.get(stem, 0) + 1
        inv["invoice_number"] = f"{stem}{_DAY_SEQUENCES[stem]}"
        inv["issue_date"] = issued.isoformat()
        inv["due_date"] = due.isoformat()
        if status == "paid":
            paid = min(issued + timedelta(days=random.randint(0, 25)), TODAY)
            inv["paid_at"] = paid.isoformat()
            inv["payment_method"] = random.choice(["cash", "twint", "iban"])
        if status == "issued":
            inv["reminders"] = _reminders(due)
    return inv


def _reminders(due: date) -> list[dict]:
    """Up to two reminders for an overdue invoice, each giving 10 more days."""
    reminders: list[dict] = []
    sent = due + timedelta(days=5)
    while sent <= TODAY and len(reminders) < 2 and random.random() < 0.7:
        reminders.append(
            {"sent_on": sent.isoformat(), "due_on": (sent + timedelta(days=10)).isoformat()}
        )
        sent += timedelta(days=15)
    return reminders


WITHDRAWAL_REASONS = [
    ("tasting", "Dégustation au caveau"),
    ("promotion", "Lot pour la tombola du FC"),
    ("loss", "Bouteille cassée"),
    ("other", ""),
]


def _stock_withdrawals() -> list[dict]:
    withdrawals = []
    for _ in range(12):
        reason, note = random.choice(WITHDRAWAL_REASONS)
        withdrawals.append(
            {
                "article_name": random.choice(ARTICLES[:4]),
                "date": (TODAY - timedelta(days=random.randint(0, 365))).isoformat(),
                "quantity": random.choice([1, 2, 3, 6]),
                "reason": reason,
                "note": note,
            }
        )
    return sorted(withdrawals, key=lambda w: w["date"])


def main() -> None:
    customers = [_customer(i) for i in range(100)]

    invoices = []
    for c in customers:
        for _ in range(random.randint(1, 10)):
            if c["email"] is None:
                continue
            invoices.append(_invoice(c["email"]))

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
                "twint_phone": "+41791234567",
                "phone": "+41241234567",
                "vat_number": "CHE-123.456.789 TVA",
                "default_vat_rate": 0.081,
                "payment_terms_days": 30,
                "reminder_terms_days": 10,
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
            {
                "name": "Gamaret 2019",
                "description": "Millésime épuisé",
                "unit_price": 22.00,
                "vat_rate_override": None,
                "stock_quantity": 0,
                "is_archived": True,
            },
        ],
        "customers": customers,
        "invoices": invoices,
        "stock_withdrawals": _stock_withdrawals(),
    }

    out = Path(__file__).parent / "demo.json"
    out.write_text(json.dumps(fixture, indent=2, ensure_ascii=False))
    n_inv = len([inv for inv in invoices if inv.get("customer_email")])
    print(f"Generated {len(customers)} customers, {n_inv} invoices → {out}")


if __name__ == "__main__":
    main()
