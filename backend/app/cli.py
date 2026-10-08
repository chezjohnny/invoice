"""Backend CLI — usage: uv run python -m app.cli <command> [options]"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, Base, engine
from app.models.invoice import (
    Invoice,
    InvoiceLine,
    InvoiceReminder,
    InvoiceStatus,
    PaymentMethod,
)
from app.models.stock_withdrawal import StockWithdrawal, StockWithdrawalReason
from app.models.tenant import Tenant, TenantProfile, User
from app.services.invoices import effective_vat_rate
from app.services.tenants import TenantError, create_tenant, set_password


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
        await _load_stock_withdrawals(db, tenant.id, data.get("stock_withdrawals", []), article_map)

        await db.commit()

    print(f"✓ Fixtures loaded from {path}")


def _ask_password() -> str:
    """Typed twice at a terminal; read from stdin when piped (a script, docker -T)."""
    if not sys.stdin.isatty():
        return sys.stdin.readline().rstrip("\n")
    password = getpass.getpass("Password: ")
    if getpass.getpass("Password again: ") != password:
        raise TenantError("The two passwords differ")
    return password


async def _create_tenant(name: str, subdomain: str, email: str) -> None:
    password = _ask_password()
    async with AsyncSessionLocal() as db:
        await create_tenant(db, name=name, subdomain=subdomain, email=email, password=password)
        await db.commit()


async def _set_password(email: str, sign_out: bool) -> None:
    password = _ask_password()
    async with AsyncSessionLocal() as db:
        await set_password(db, email=email, password=password, sign_out=sign_out)
        await db.commit()


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

            # Articles have no DB-level CASCADE from tenants, so delete them first,
            # after the stock withdrawals that restrict their deletion
            await db.execute(
                delete(StockWithdrawal).where(StockWithdrawal.tenant_id == existing_tenant.id)
            )
            await db.execute(delete(Article).where(Article.tenant_id == existing_tenant.id))
            # All other child tables (customers, invoices, profile, users) have ondelete=CASCADE
            await db.execute(delete(Tenant).where(Tenant.id == existing_tenant.id))
        elif existing_user:
            await db.execute(delete(User).where(User.email == spec["admin_email"]))
        await db.flush()

    user = await create_tenant(
        db,
        name=spec["name"],
        subdomain=spec["subdomain"],
        email=spec["admin_email"],
        password=spec["admin_password"],
    )
    profile = (
        await db.execute(select(TenantProfile).where(TenantProfile.tenant_id == user.tenant_id))
    ).scalar_one()
    p = spec["profile"]
    profile.company_name = p["company_name"]
    profile.address_line1 = p["address_line1"]
    profile.postal_code = p["postal_code"]
    profile.city = p["city"]
    profile.country = p.get("country", "CH")
    profile.iban = p.get("iban")
    profile.twint_phone = p.get("twint_phone")
    profile.phone = p.get("phone")
    profile.vat_number = p.get("vat_number")
    if p.get("default_vat_rate") is not None:
        profile.default_vat_rate = Decimal(str(p["default_vat_rate"]))
    profile.payment_terms_days = p.get("payment_terms_days", 30)
    profile.reminder_terms_days = p.get("reminder_terms_days", 10)
    await db.flush()
    print(f"  ✓ Tenant '{spec['name']}' — login: {spec['admin_email']} / {spec['admin_password']}")
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
            is_archived=spec.get("is_archived", False),
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
            address_line2=spec.get("address_line2"),
            postal_code=spec.get("postal_code", ""),
            city=spec.get("city", ""),
            country=spec.get("country", "CH"),
            phones=spec.get("phones", []),
            is_archived=spec.get("is_archived", False),
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
    profile = (
        await db.execute(select(TenantProfile).where(TenantProfile.tenant_id == tenant_id))
    ).scalar_one()
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
            paid_at=date.fromisoformat(spec["paid_at"]) if spec.get("paid_at") else None,
            payment_method=(
                PaymentMethod(spec["payment_method"]) if spec.get("payment_method") else None
            ),
            discount_percent=Decimal(str(spec.get("discount_percent", 0))),
            notes=spec.get("notes", ""),
        )
        db.add(invoice)
        await db.flush()

        for position, line_spec in enumerate(spec.get("lines", [])):
            article_id = article_map.get(line_spec["article_name"])
            if article_id is None:
                print(f"  ⚠ Unknown article '{line_spec['article_name']}' — skipping line")
                continue
            from app.models.article import Article

            article = (
                await db.execute(select(Article).where(Article.id == article_id))
            ).scalar_one()
            offered = line_spec.get("offered", False)
            line = InvoiceLine(
                invoice_id=invoice.id,
                article_id=article_id,
                description_snapshot=article.name,
                quantity=line_spec["quantity"],
                unit_price_snapshot=0 if offered else article.unit_price,
                vat_rate_snapshot=None if offered else effective_vat_rate(article, profile),
                offered=offered,
                position=position,
            )
            db.add(line)
            # As issuing records it; the fixture stock is already the current one.
            if offered and invoice.issue_date and status != InvoiceStatus.CANCELLED:
                db.add(
                    StockWithdrawal(
                        tenant_id=tenant_id,
                        article_id=article_id,
                        date=invoice.issue_date,
                        quantity=line.quantity,
                        reason=StockWithdrawalReason.PROMOTION,
                        invoice_id=invoice.id,
                    )
                )
        for number, reminder in enumerate(spec.get("reminders", []), start=1):
            db.add(
                InvoiceReminder(
                    invoice_id=invoice.id,
                    number=number,
                    sent_on=date.fromisoformat(reminder["sent_on"]),
                    due_on=date.fromisoformat(reminder["due_on"]),
                )
            )

    print(f"  ✓ {len(specs)} invoices")


async def _load_stock_withdrawals(
    db: AsyncSession, tenant_id: Any, specs: list[dict[str, Any]], article_map: dict[str, Any]
) -> None:
    """As recorded: the fixture stock is already the current one, none is taken."""
    for spec in specs:
        db.add(
            StockWithdrawal(
                tenant_id=tenant_id,
                article_id=article_map[spec["article_name"]],
                date=date.fromisoformat(spec["date"]),
                quantity=spec["quantity"],
                reason=StockWithdrawalReason(spec["reason"]),
                note=spec.get("note", ""),
            )
        )
    print(f"  ✓ {len(specs)} stock withdrawals")


def run_shell() -> None:
    """Interactive REPL with the app, a live DB session and all models preloaded."""
    from sqlalchemy import func, update

    from app.core.config import settings
    from app.models.article import Article
    from app.models.customer import Customer

    db = AsyncSessionLocal()
    namespace: dict[str, Any] = {
        "db": db,
        "engine": engine,
        "AsyncSessionLocal": AsyncSessionLocal,
        "Base": Base,
        "settings": settings,
        "select": select,
        "func": func,
        "delete": delete,
        "update": update,
        "Article": Article,
        "Customer": Customer,
        "Invoice": Invoice,
        "InvoiceLine": InvoiceLine,
        "InvoiceReminder": InvoiceReminder,
        "InvoiceStatus": InvoiceStatus,
        "PaymentMethod": PaymentMethod,
        "StockWithdrawal": StockWithdrawal,
        "StockWithdrawalReason": StockWithdrawalReason,
        "Tenant": Tenant,
        "TenantProfile": TenantProfile,
        "User": User,
    }
    models = ", ".join(sorted(k for k in namespace if k[0].isupper()))
    banner = (
        f"Invoice shell — DB: {settings.database_url}\n"
        "  Preloaded: db (AsyncSession), engine, settings, select/func/delete/update\n"
        f"  Models: {models}\n"
        "  Top-level await works, e.g.  await db.scalar(select(func.count(User.id)))\n"
    )

    try:
        from IPython import start_ipython

        print(banner)
        start_ipython(argv=["--no-banner"], user_ns=namespace)
    except ImportError:
        import code

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        namespace["run"] = loop.run_until_complete
        print(banner)
        print("  (IPython not installed — no top-level await; use run(coro) instead)")
        code.interact(local=namespace)


def main() -> None:
    parser = argparse.ArgumentParser(description="Invoice backend CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("shell", help="Interactive shell with the app and DB preloaded")

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

    p_tenant = sub.add_parser(
        "create-tenant", help="Create a tenant and its admin; the password is asked for"
    )
    p_tenant.add_argument("--name", required=True, help="Company name, e.g. 'Saudan Vins'")
    p_tenant.add_argument("--subdomain", required=True, help="Short identifier, e.g. 'saudan'")
    p_tenant.add_argument("--email", required=True, help="The admin's login")

    p_password = sub.add_parser(
        "set-password", help="Change a user's password; the new one is asked for"
    )
    p_password.add_argument("--email", required=True)
    p_password.add_argument(
        "--sign-out",
        action="store_true",
        help="Also end the sessions open on every device",
    )

    args = parser.parse_args()

    if args.command == "shell":
        run_shell()
    elif args.command == "load-fixtures":
        path = Path(args.file)
        if not path.exists():
            print(f"Error: fixtures file not found: {path}", file=sys.stderr)
            sys.exit(1)
        asyncio.run(_load_fixtures(path, args.reset))
    elif args.command in ("create-tenant", "set-password"):
        try:
            if args.command == "create-tenant":
                asyncio.run(_create_tenant(args.name, args.subdomain, args.email))
                print(f"✓ Tenant '{args.name}' created — login: {args.email}")
            else:
                asyncio.run(_set_password(args.email, args.sign_out))
                ended = ", open sessions ended" if args.sign_out else ""
                print(f"✓ Password changed for {args.email}{ended}")
        except TenantError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
