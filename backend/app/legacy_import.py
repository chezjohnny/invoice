"""Import the JSON files produced by the Qt3 KInvoice converter."""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import Tenant, TenantProfile
from app.services.invoice_numbers import from_reference


def _read_array(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list) or any(not isinstance(row, dict) for row in value):
        raise ValueError(f"Expected a JSON array of objects in {path}")
    return value


def _decimal(value: Any, *, default: Decimal | None = None) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"Invalid decimal value: {value!r}") from exc


def _normalize_name(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in decomposed if not unicodedata.combining(char))
    return " ".join(re.findall(r"[a-z0-9]+", without_accents))


def _split_name(value: str) -> tuple[str, str]:
    parts = value.strip().split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[1], parts[0]


def _customer_values(spec: dict[str, Any]) -> dict[str, Any]:
    name = str(spec.get("name") or spec.get("nom") or "Client importé").strip()
    if spec.get("first_name") is not None or spec.get("last_name") is not None:
        first_name = str(spec.get("first_name") or "").strip()
        last_name = str(spec.get("last_name") or "").strip()
    else:
        first_name, last_name = _split_name(name)

    address = str(spec.get("address_line1") or spec.get("adresse") or "").strip()
    postal_code = str(spec.get("postal_code") or spec.get("cp") or "").strip()
    city = str(spec.get("city") or spec.get("ville") or "").strip()
    country = str(spec.get("country") or spec.get("pays") or "CH").strip().upper()
    if len(country) != 2:
        country = "CH"

    if not address and spec.get("address") and spec["address"] != "N/A":
        address_parts = [part.strip() for part in str(spec["address"]).split(",") if part.strip()]
        address = address_parts[0] if address_parts else ""
        if len(address_parts) > 1:
            postal_city = address_parts[1].split(maxsplit=1)
            if postal_city and postal_city[0].isdigit():
                postal_code = postal_city[0]
                city = postal_city[1] if len(postal_city) > 1 else ""
        if len(address_parts) > 2 and len(address_parts[-1]) == 2:
            country = address_parts[-1].upper()

    phones = spec.get("phones")
    if not isinstance(phones, list):
        phones = [
            {"label": label, "number": str(spec[key]).strip()}
            for label, key in (("Téléphone", "tel"), ("Mobile", "mobile"))
            if spec.get(key)
        ]

    return {
        "first_name": first_name or name,
        "last_name": last_name,
        "email": str(spec.get("email") or "").strip() or None,
        "address_line1": address[:200],
        "postal_code": postal_code[:20],
        "city": city[:100],
        "country": country,
        "phones": phones,
    }


def _bill_to_name(value: Any) -> str:
    return next((line.strip() for line in str(value or "").splitlines() if line.strip()), "")


def _invoice_customer_values(spec: dict[str, Any]) -> dict[str, Any]:
    lines = [line.strip() for line in str(spec.get("client") or "").splitlines() if line.strip()]
    name = lines[0] if lines else "Client importé"
    values = _customer_values({"name": name})
    if len(lines) > 1:
        address_parts = [line for line in lines[1:] if line != "N/A"]
        postal_index = next(
            (index for index, line in enumerate(address_parts) if re.match(r"^\d{4,6}\b", line)),
            None,
        )
        if postal_index is not None:
            postal_city = address_parts[postal_index].split(maxsplit=1)
            values["postal_code"] = postal_city[0]
            values["city"] = postal_city[1] if len(postal_city) > 1 else ""
            address_parts = address_parts[:postal_index] + address_parts[postal_index + 1 :]
        values["address_line1"] = ", ".join(address_parts)[:200]
    return values


def _vat_rate(value: Any) -> Decimal | None:
    rate = _decimal(value)
    if rate is not None and rate > 1:
        rate /= Decimal("100")
    return rate


def _legacy_paid_date(spec: dict[str, Any], issue_date: date | None) -> date | None:
    for key in (
        "modified_at",
        "updated_at",
        "modified_date",
        "modification_date",
        "date_modification",
    ):
        if spec.get(key):
            return date.fromisoformat(str(spec[key])[:10])
    for key in ("created_at", "creation_date", "created_date", "date_creation"):
        if spec.get(key):
            return date.fromisoformat(str(spec[key])[:10])
    return issue_date


async def import_legacy_data(
    db: AsyncSession,
    tenant_subdomain: str,
    customers_path: Path,
    products_path: Path,
    invoices_path: Path,
) -> dict[str, int]:
    customers_data = _read_array(customers_path)
    products_data = _read_array(products_path)
    invoices_data = _read_array(invoices_path)

    tenant = await db.scalar(select(Tenant).where(Tenant.subdomain == tenant_subdomain))
    if tenant is None:
        raise ValueError(f"Tenant not found: {tenant_subdomain}")

    for model in (Customer, Article, Invoice):
        count = await db.scalar(
            select(func.count(model.id)).where(model.tenant_id == tenant.id)
        )
        if count:
            raise ValueError(
                f"Tenant '{tenant_subdomain}' already contains {model.__tablename__}; "
                "legacy import requires an empty tenant"
            )

    profile = await db.scalar(
        select(TenantProfile).where(TenantProfile.tenant_id == tenant.id)
    )
    if profile is None:
        raise ValueError(f"Tenant profile not found: {tenant_subdomain}")

    customer_ids_by_name: dict[str, list[Any]] = {}
    customer_ids_by_legacy_id: dict[str, list[Any]] = {}
    imported_customer_count = 0
    for spec in customers_data:
        name = str(spec.get("name") or spec.get("nom") or "Client importé").strip()
        customer = Customer(id=uuid.uuid4(), tenant_id=tenant.id, **_customer_values(spec))
        db.add(customer)
        imported_customer_count += 1
        customer_ids_by_name.setdefault(_normalize_name(name), []).append(customer.id)
        legacy_id = str(spec.get("legacy_id") or spec.get("identifiant") or "").strip()
        if legacy_id:
            customer_ids_by_legacy_id.setdefault(legacy_id, []).append(customer.id)

    articles_by_reference: dict[str, list[tuple[Any, str, Decimal]]] = {}
    for spec in products_data:
        reference = str(spec.get("reference") or spec.get("ref") or "").strip()
        name = str(spec.get("name") or spec.get("desc") or reference or "Article importé")
        price = _decimal(spec.get("price", spec.get("prix")), default=Decimal("0"))
        unit_price = price or Decimal("0")
        stock_quantity = int(spec.get("stock", 0) or 0)
        article = Article(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name=name[:200],
            description=str(spec.get("description") or spec.get("desc") or "")[:500],
            unit_price=unit_price,
            stock_quantity=stock_quantity,
            is_archived=stock_quantity <= 0,
        )
        db.add(article)
        if reference:
            articles_by_reference.setdefault(reference, []).append((article.id, name, unit_price))

    invoices_by_bill_to: dict[str, Any] = {}
    imported_invoice_count = 0
    for spec in invoices_data:
        bill_to = _bill_to_name(spec.get("client"))
        bill_to_key = _normalize_name(bill_to)
        matching_customers = customer_ids_by_name.get(bill_to_key, []) if bill_to_key else []
        customer_id = matching_customers[0] if len(matching_customers) == 1 else None
        legacy_id = str(spec.get("idClient") or "").strip()
        if customer_id is None and matching_customers and legacy_id:
            legacy_customer_id_set = set(customer_ids_by_legacy_id.get(legacy_id, []))
            matching_by_id = [
                customer_id
                for customer_id in matching_customers
                if customer_id in legacy_customer_id_set
            ]
            if len(matching_by_id) == 1:
                customer_id = matching_by_id[0]
        if customer_id is None and bill_to_key:
            customer_id = invoices_by_bill_to.get(bill_to_key)

        if customer_id is None and not bill_to_key:
            legacy_customer_ids = customer_ids_by_legacy_id.get(legacy_id, [])
            if len(legacy_customer_ids) == 1:
                customer_id = legacy_customer_ids[0]

        if customer_id is None:
            values = _invoice_customer_values(spec)
            customer = Customer(id=uuid.uuid4(), tenant_id=tenant.id, **values)
            db.add(customer)
            imported_customer_count += 1
            customer_id = customer.id
            if bill_to_key:
                invoices_by_bill_to[bill_to_key] = customer_id

        issue_date = date.fromisoformat(spec["date"]) if spec.get("date") else None
        due_date = date.fromisoformat(spec["echeance"]) if spec.get("echeance") else None
        invoice = Invoice(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            customer_id=customer_id,
            invoice_number=(
                from_reference(profile.invoice_prefix, str(spec["ref"]).strip())
                if str(spec.get("ref") or "").strip()
                else None
            ),
            status=InvoiceStatus.PAID,
            issue_date=issue_date,
            due_date=due_date,
            paid_at=_legacy_paid_date(spec, issue_date),
            notes="\n".join(
                filter(
                    None,
                    [
                        str(spec.get("refCommande") or "").strip(),
                        str(spec.get("paiement") or "").strip(),
                    ],
                )
            )[:1000],
        )
        db.add(invoice)

        invoice_vat = _vat_rate(spec.get("tva"))
        for line_spec in spec.get("achats", []):
            reference = str(line_spec.get("ref") or "").strip().casefold()
            description = str(line_spec.get("desc") or reference or "Article")[:500]
            quantity = int(line_spec.get("quantite", 1) or 1)
            source_unit_price = _decimal(line_spec.get("puht"))
            line_unit_price = source_unit_price
            if line_unit_price is None:
                line_unit_price = (
                    _decimal(line_spec.get("pht"), default=Decimal("0")) or Decimal("0")
                )
                if quantity:
                    line_unit_price /= quantity
            discount = _decimal(line_spec.get("remise"), default=Decimal("0")) or Decimal("0")
            line_unit_price = (
                line_unit_price * (Decimal("100") - discount) / Decimal("100")
            ).quantize(Decimal("0.01"))
            article_options = articles_by_reference.get(reference, [])
            name_matches = [
                option for option in article_options
                if _normalize_name(option[1]) == _normalize_name(description)
            ]
            article_matches = name_matches
            if len(article_matches) != 1 and source_unit_price is not None:
                price_matches = [
                    option for option in (name_matches or article_options)
                    if option[2] == source_unit_price
                ]
                if len(price_matches) == 1:
                    article_matches = price_matches
            if len(article_matches) != 1 and not name_matches and len(article_options) == 1:
                article_matches = article_options
            article_id = article_matches[0][0] if len(article_matches) == 1 else None
            db.add(
                InvoiceLine(
                    invoice_id=invoice.id,
                    article_id=article_id,
                    description_snapshot=description,
                    quantity=quantity,
                    unit_price_snapshot=line_unit_price,
                    vat_rate_snapshot=(
                        invoice_vat if invoice_vat is not None else profile.default_vat_rate
                    ),
                )
            )
        imported_invoice_count += 1

    await db.commit()
    return {
        "customers": imported_customer_count,
        "articles": len(products_data),
        "invoices": imported_invoice_count,
        "unmatched_invoice_customers": len(invoices_by_bill_to),
    }