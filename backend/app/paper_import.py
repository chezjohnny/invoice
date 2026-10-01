"""Import paper invoices typed by hand in a compact text file.

Format (blank lines and ``#`` comments are ignored)::

    db: Désir Blanc 75cl 2026, prix: 15.0, quantité: 150
    <customer uuid>/202512205763
    - db:12

Article quantities are the stock before these invoices: imported lines are
deducted from it, as issuing an invoice does.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import TenantProfile
from app.services.invoice_numbers import from_reference

_ARTICLE_RE = re.compile(
    r"^(?P<alias>\w+)\s*:\s*(?P<name>.+?)\s*,\s*prix\s*:\s*(?P<price>\d+(?:\.\d+)?)"
    r"\s*,\s*quantit[ée]\s*:\s*(?P<stock>-?\d+)$",
    re.IGNORECASE,
)
_HEADER_RE = re.compile(r"^(?P<customer>[0-9a-fA-F-]{36})\s*/\s*(?P<reference>\d{12,})$")
_LINE_RE = re.compile(r"^-\s*(?P<alias>\w+)\s*:\s*(?P<quantity>\d+)$")


@dataclass
class PaperArticle:
    name: str
    unit_price: Decimal
    stock_quantity: int


@dataclass
class PaperLine:
    article: PaperArticle
    quantity: int


@dataclass
class PaperInvoice:
    customer_id: uuid.UUID
    reference: str
    issue_date: date
    lines: list[PaperLine] = field(default_factory=list)


@dataclass
class PaperFile:
    articles: list[PaperArticle]
    invoices: list[PaperInvoice]


def parse_paper_file(text: str) -> PaperFile:
    articles: dict[str, PaperArticle] = {}
    invoices: list[PaperInvoice] = []
    # Aliases may be declared after their first use: lines are resolved at the end.
    pending_lines: list[tuple[int, PaperInvoice, str, int]] = []
    header_lines: dict[str, int] = {}
    current: PaperInvoice | None = None

    for lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        if match := _LINE_RE.match(line):
            if current is None:
                raise ValueError(f"line {lineno}: invoice line outside an invoice")
            quantity = int(match["quantity"])
            if quantity <= 0:
                raise ValueError(f"line {lineno}: quantity must be positive")
            pending_lines.append((lineno, current, match["alias"].casefold(), quantity))
        elif match := _HEADER_RE.match(line):
            reference = match["reference"]
            if reference in header_lines:
                raise ValueError(
                    f"line {lineno}: reference {reference} already used "
                    f"on line {header_lines[reference]}"
                )
            try:
                customer_id = uuid.UUID(match["customer"])
            except ValueError as exc:
                raise ValueError(f"line {lineno}: invalid customer id") from exc
            try:
                issue_date = datetime.strptime(reference[:8], "%Y%m%d").date()
            except ValueError as exc:
                raise ValueError(
                    f"line {lineno}: reference {reference} does not start with a valid date"
                ) from exc
            header_lines[reference] = lineno
            current = PaperInvoice(customer_id, reference, issue_date)
            invoices.append(current)
        elif match := _ARTICLE_RE.match(line):
            alias = match["alias"].casefold()
            if alias in articles:
                raise ValueError(f"line {lineno}: alias '{alias}' already defined")
            articles[alias] = PaperArticle(
                name=match["name"][:200],
                unit_price=Decimal(match["price"]),
                stock_quantity=int(match["stock"]),
            )
        else:
            raise ValueError(f"line {lineno}: unrecognized line: {line}")

    for lineno, invoice, alias, quantity in pending_lines:
        article = articles.get(alias)
        if article is None:
            raise ValueError(f"line {lineno}: unknown article alias '{alias}'")
        invoice.lines.append(PaperLine(article, quantity))

    for invoice in invoices:
        if not invoice.lines:
            raise ValueError(
                f"line {header_lines[invoice.reference]}: invoice {invoice.reference} has no lines"
            )

    return PaperFile(list(articles.values()), invoices)


async def import_paper_invoices(
    db: AsyncSession, text: str, *, dry_run: bool = False
) -> dict[str, int]:
    paper = parse_paper_file(text)
    if not paper.invoices:
        raise ValueError("No invoice found in the file")

    customer_ids = {invoice.customer_id for invoice in paper.invoices}
    customers = {
        customer.id: customer
        for customer in await db.scalars(select(Customer).where(Customer.id.in_(customer_ids)))
    }
    missing = sorted(str(customer_id) for customer_id in customer_ids - customers.keys())
    if missing:
        raise ValueError(f"Unknown customer id: {', '.join(missing)}")
    tenant_ids = {customer.tenant_id for customer in customers.values()}
    if len(tenant_ids) > 1:
        raise ValueError("Customers belong to several tenants")
    tenant_id = tenant_ids.pop()

    profile = await db.scalar(select(TenantProfile).where(TenantProfile.tenant_id == tenant_id))
    if profile is None:
        raise ValueError("Tenant profile not found")

    existing_articles = {
        article.name: article
        for article in await db.scalars(select(Article).where(Article.tenant_id == tenant_id))
    }
    articles: dict[str, Article] = {}
    articles_created = 0
    for paper_article in paper.articles:
        article = existing_articles.get(paper_article.name)
        if article is None:
            article = Article(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=paper_article.name,
                unit_price=paper_article.unit_price,
                stock_quantity=paper_article.stock_quantity,
                is_archived=False,
            )
            db.add(article)
            articles_created += 1
        articles[paper_article.name] = article

    numbers = {
        spec.reference: from_reference(profile.invoice_prefix, spec.reference)
        for spec in paper.invoices
    }
    existing_numbers = set(
        await db.scalars(
            select(Invoice.invoice_number).where(
                Invoice.tenant_id == tenant_id,
                Invoice.invoice_number.in_(numbers.values()),
            )
        )
    )
    invoices_created = 0
    for spec in paper.invoices:
        if numbers[spec.reference] in existing_numbers:
            continue
        invoice = Invoice(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            customer_id=spec.customer_id,
            invoice_number=numbers[spec.reference],
            status=InvoiceStatus.PAID,
            issue_date=spec.issue_date,
            due_date=spec.issue_date + timedelta(days=profile.payment_terms_days),
            paid_at=spec.issue_date,
        )
        db.add(invoice)
        for line in spec.lines:
            article = articles[line.article.name]
            db.add(
                InvoiceLine(
                    invoice_id=invoice.id,
                    article_id=article.id,
                    description_snapshot=article.name,
                    quantity=line.quantity,
                    unit_price_snapshot=article.unit_price,
                    vat_rate_snapshot=(
                        article.vat_rate_override
                        if article.vat_rate_override is not None
                        else profile.default_vat_rate
                    ),
                )
            )
            article.stock_quantity -= line.quantity
        invoices_created += 1

    if dry_run:
        await db.rollback()
    else:
        await db.commit()
    return {
        "articles_created": articles_created,
        "articles_reused": len(paper.articles) - articles_created,
        "invoices_created": invoices_created,
        "invoices_skipped": len(paper.invoices) - invoices_created,
    }
