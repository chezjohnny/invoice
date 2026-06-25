"""Backend CLI — usage: uv run python -m app.cli <command> [options]"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import hash_password
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import Tenant, TenantProfile, User


async def _init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ Database tables created")


async def _load_fixtures(path: Path, reset: bool) -> None:
    data = json.loads(path.read_text())

    async with AsyncSessionLocal() as db:
        created = await _load_tenant(db, data["tenant"], reset)
        if not created:
            return

        tenant = (
            await db.execute(select(Tenant).where(Tenant.subdomain == data["tenant"]["subdomain"]))
        ).scalar_one()

        article_map = await _load_articles(db, tenant.id, data.get("articles", []))
        customer_map = await _load_customers(db, tenant.id, data.get("customers", []))
        await _load_invoices(db, tenant.id, data.get("invoices", []), article_map, customer_map)

        await db.commit()

    print(f"✓ Fixtures loaded from {path}")


async def _load_tenant(db: AsyncSession, spec: dict[str, Any], reset: bool) -> bool:
    """Return True if tenant was created (or reset), False if skipped."""
    existing_tenant = (
        await db.execute(select(Tenant).where(Tenant.subdomain == spec["subdomain"]))
    ).scalar_one_or_none()
    existing_user = (
        await db.execute(select(User).where(User.email == spec["admin_email"]))
    ).scalar_one_or_none()

    already_exists = existing_tenant is not None or existing_user is not None
    if already_exists and not reset:
        print(
            f"  Tenant '{spec['subdomain']}' or user '{spec['admin_email']}' already exists"
            " — skipping (use --reset to overwrite)"
        )
        return False

    if already_exists and reset:
        print(f"  Resetting tenant '{spec['subdomain']}' …")
        if existing_tenant:
            from app.models.article import Article

            # Articles have no DB-level CASCADE from tenants, so delete them first
            await db.execute(delete(Article).where(Article.tenant_id == existing_tenant.id))
            # All other child tables (customers, invoices, profile, users) have ondelete=CASCADE
            await db.execute(delete(Tenant).where(Tenant.id == existing_tenant.id))
        elif existing_user:
            await db.execute(delete(User).where(User.email == spec["admin_email"]))
        await db.flush()

    tenant = Tenant(name=spec["name"], subdomain=spec["subdomain"])
    db.add(tenant)
    await db.flush()

    p = spec["profile"]
    profile = TenantProfile(
        tenant_id=tenant.id,
        company_name=p["company_name"],
        address_line1=p["address_line1"],
        postal_code=p["postal_code"],
        city=p["city"],
        country=p.get("country", "CH"),
        iban=p.get("iban"),
        vat_number=p.get("vat_number"),
        default_vat_rate=(
            Decimal(str(p["default_vat_rate"])) if p.get("default_vat_rate") is not None else None
        ),
        invoice_prefix=p.get("invoice_prefix", "INV"),
        invoice_next_number=p.get("invoice_next_number", 1),
        payment_terms_days=p.get("payment_terms_days", 30),
    )
    db.add(profile)

    user = User(
        tenant_id=tenant.id,
        email=spec["admin_email"],
        hashed_password=hash_password(spec["admin_password"]),
    )
    db.add(user)
    await db.flush()
    print(f"  ✓ Tenant '{tenant.name}' — login: {spec['admin_email']} / {spec['admin_password']}")
    return True


async def _load_articles(
    db: AsyncSession, tenant_id: object, specs: list[dict[str, Any]]
) -> dict[str, Any]:
    from app.models.article import Article

    name_to_id: dict[str, Any] = {}
    for spec in specs:
        article = Article(
            tenant_id=tenant_id,
            name=spec["name"],
            description=spec.get("description", ""),
            unit_price=Decimal(str(spec["unit_price"])),
            vat_rate_override=(
                Decimal(str(spec["vat_rate_override"]))
                if spec.get("vat_rate_override") is not None
                else None
            ),
            stock_quantity=spec.get("stock_quantity", 0),
        )
        db.add(article)
        await db.flush()
        name_to_id[spec["name"]] = article.id
    print(f"  ✓ {len(specs)} articles")
    return name_to_id


async def _load_customers(
    db: AsyncSession, tenant_id: object, specs: list[dict[str, Any]]
) -> dict[str, Any]:
    from app.models.customer import Customer

    email_to_id: dict[str, Any] = {}
    for spec in specs:
        customer = Customer(
            tenant_id=tenant_id,
            first_name=spec["first_name"],
            last_name=spec["last_name"],
            email=spec.get("email"),
            address_line1=spec.get("address_line1", ""),
            postal_code=spec.get("postal_code", ""),
            city=spec.get("city", ""),
            country=spec.get("country", "CH"),
            phones=spec.get("phones", []),
        )
        db.add(customer)
        await db.flush()
        if spec.get("email"):
            email_to_id[spec["email"]] = customer.id
    print(f"  ✓ {len(specs)} customers")
    return email_to_id


async def _load_invoices(
    db: AsyncSession,
    tenant_id: object,
    specs: list[dict[str, Any]],
    article_map: dict[str, Any],
    customer_map: dict[str, Any],
) -> None:
    for spec in specs:
        customer_id = customer_map.get(spec["customer_email"])
        if customer_id is None:
            print(f"  ⚠ Unknown customer email '{spec['customer_email']}' — skipping invoice")
            continue

        status = InvoiceStatus(spec["status"])
        invoice = Invoice(
            tenant_id=tenant_id,
            customer_id=customer_id,
            status=status,
            invoice_number=spec.get("invoice_number"),
            issue_date=date.fromisoformat(spec["issue_date"]) if spec.get("issue_date") else None,
            due_date=date.fromisoformat(spec["due_date"]) if spec.get("due_date") else None,
            discount_percent=Decimal(str(spec.get("discount_percent", 0))),
            notes=spec.get("notes", ""),
        )
        db.add(invoice)
        await db.flush()

        for line_spec in spec.get("lines", []):
            article_id = article_map.get(line_spec["article_name"])
            if article_id is None:
                print(f"  ⚠ Unknown article '{line_spec['article_name']}' — skipping line")
                continue
            from app.models.article import Article
            article = (
                await db.execute(select(Article).where(Article.id == article_id))
            ).scalar_one()
            profile = (
                await db.execute(
                    select(TenantProfile).where(TenantProfile.tenant_id == tenant_id)
                )
            ).scalar_one()
            vat = (
                article.vat_rate_override
                if article.vat_rate_override is not None
                else profile.default_vat_rate
            )
            line = InvoiceLine(
                invoice_id=invoice.id,
                article_id=article_id,
                description_snapshot=article.name,
                quantity=line_spec["quantity"],
                unit_price_snapshot=article.unit_price,
                vat_rate_snapshot=vat,
            )
            db.add(line)

    print(f"  ✓ {len(specs)} invoices")


def main() -> None:
    parser = argparse.ArgumentParser(description="Invoice backend CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="Create all database tables (SQLite dev only)")

    p_fixtures = sub.add_parser("load-fixtures", help="Load fixture data into the database")
    p_fixtures.add_argument(
        "file",
        nargs="?",
        default="fixtures/demo.json",
        help="Path to the JSON fixtures file (default: fixtures/demo.json)",
    )
    p_fixtures.add_argument(
        "--reset",
        action="store_true",
        help="Delete and recreate the tenant if it already exists",
    )

    args = parser.parse_args()

    if args.command == "init-db":
        asyncio.run(_init_db())
    elif args.command == "load-fixtures":
        path = Path(args.file)
        if not path.exists():
            print(f"Error: fixtures file not found: {path}", file=sys.stderr)
            sys.exit(1)
        asyncio.run(_load_fixtures(path, args.reset))


if __name__ == "__main__":
    main()
