import uuid
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.crud import get_owned, get_profile
from app.api.deps import get_current_user
from app.api.sorting import SortColumn, SortOrder, sort_clauses
from app.core.database import get_db
from app.core.search import contains, matches_words
from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine, InvoiceReminder, InvoiceStatus
from app.models.stock_withdrawal import StockWithdrawal, StockWithdrawalReason
from app.models.tenant import User
from app.schemas.common import PagedResponse
from app.schemas.invoice import (
    InvoiceCreate,
    InvoicePayment,
    InvoicePaymentDateUpdate,
    InvoicePaymentMethodUpdate,
    InvoiceResponse,
    InvoiceUpdate,
)
from app.services.customers import customer_names
from app.services.invoice_numbers import next_invoice_number
from app.services.invoices import invoice_total_sql, recent_first
from app.services.pdf import Lang, generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])

InvoiceSort = Literal["number", "customer", "date", "due", "paid_at", "total", "status"]


@router.get("", response_model=PagedResponse[InvoiceResponse])
async def list_invoices(
    search: str = Query(""),
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    customer_id: uuid.UUID | None = Query(None),
    sort: InvoiceSort | None = Query(None),
    order: SortOrder = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[InvoiceResponse]:
    conditions = [Invoice.tenant_id == current_user.tenant_id]
    if customer_id:
        conditions.append(Invoice.customer_id == customer_id)
    if status_filter is not None:
        conditions.append(Invoice.status == status_filter)
    if search:
        conditions.append(
            matches_words(
                search,
                lambda pattern: or_(
                    contains(Invoice.invoice_number, pattern),
                    Invoice.lines.any(contains(InvoiceLine.description_snapshot, pattern)),
                    Invoice.customer_id.in_(
                        select(Customer.id).where(
                            Customer.tenant_id == current_user.tenant_id,
                            or_(
                                contains(Customer.first_name, pattern),
                                contains(Customer.last_name, pattern),
                            ),
                        )
                    ),
                ),
            )
        )

    query = select(Invoice).where(*conditions)
    if sort is None:
        ordering: list[SortColumn] = recent_first()
    else:
        if sort == "customer":
            query = query.join(Customer, Customer.id == Invoice.customer_id)
        columns: dict[str, list[SortColumn]] = {
            # The day, then the unpadded sequence: 2610052 before 26100510.
            "number": [
                func.substr(Invoice.invoice_number, 1, 6),
                func.length(Invoice.invoice_number),
                Invoice.invoice_number,
            ],
            "customer": [func.lower(Customer.last_name), func.lower(Customer.first_name)],
            "date": [Invoice.issue_date],
            "due": [Invoice.due_date],
            "paid_at": [Invoice.paid_at],
            "total": [invoice_total_sql()],
            # Workflow order rather than alphabetical.
            "status": [case(*((Invoice.status == st, rank) for st, rank in _STATUS_RANK.items()))],
        }
        ordering = [*sort_clauses(columns[sort], order), Invoice.id]

    total = (await db.scalar(select(func.count(Invoice.id)).where(*conditions))) or 0
    items = list(
        (
            await db.execute(
                query.options(selectinload(Invoice.lines), selectinload(Invoice.reminders))
                .order_by(*ordering)
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )
        .scalars()
        .all()
    )
    names = await customer_names(db, current_user.tenant_id, (i.customer_id for i in items))
    response_items = [
        InvoiceResponse.model_validate(inv).model_copy(
            update={"customer_name": names.get(inv.customer_id, "")}
        )
        for inv in items
    ]
    return PagedResponse.build(response_items, total, page, per_page)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    return await _load_invoice(invoice_id, current_user.tenant_id, db)


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    await _validate_refs(body, current_user.tenant_id, db)
    invoice = Invoice(
        tenant_id=current_user.tenant_id,
        customer_id=body.customer_id,
        discount_percent=body.discount_percent,
        notes=body.notes,
        payment_method=body.payment_method,
        lines=_lines(body),
    )
    db.add(invoice)
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft invoices can be edited")

    await _validate_refs(body, current_user.tenant_id, db)
    invoice.customer_id = body.customer_id
    invoice.discount_percent = body.discount_percent
    invoice.notes = body.notes
    invoice.payment_method = body.payment_method
    # Replaced as a whole: the delete-orphan cascade removes the previous lines.
    invoice.lines = _lines(body)

    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
async def issue_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft invoices can be issued")

    profile = await get_profile(db, current_user.tenant_id)
    if not profile.is_complete:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Company profile is incomplete: address and IBAN are required",
        )

    today = date.today()
    invoice.invoice_number = await next_invoice_number(db, current_user.tenant_id, today)
    invoice.issue_date = today
    invoice.due_date = today + timedelta(days=profile.payment_terms_days)
    invoice.status = InvoiceStatus.ISSUED
    await _move_stock(db, invoice, -1)
    _give_away(db, invoice)

    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/pay", response_model=InvoiceResponse)
async def pay_invoice(
    invoice_id: uuid.UUID,
    body: InvoicePayment | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.ISSUED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only issued invoices can be paid")
    payment = body or InvoicePayment()
    invoice.status = InvoiceStatus.PAID
    invoice.paid_at = payment.paid_at or date.today()
    if payment.payment_method is not None:
        invoice.payment_method = payment.payment_method
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.patch("/{invoice_id}/payment-date", response_model=InvoiceResponse)
async def update_payment_date(
    invoice_id: uuid.UUID,
    body: InvoicePaymentDateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.PAID:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only paid invoices have a payment date")
    invoice.paid_at = body.paid_at
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.patch("/{invoice_id}/payment-method", response_model=InvoiceResponse)
async def update_payment_method(
    invoice_id: uuid.UUID,
    body: InvoicePaymentMethodUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    # A draft changes it through PUT; a cancelled invoice is no longer paid.
    if invoice.status not in (InvoiceStatus.ISSUED, InvoiceStatus.PAID):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only issued or paid invoices can change payment method"
        )
    invoice.payment_method = body.payment_method
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only draft or issued invoices can be cancelled",
        )

    if invoice.status == InvoiceStatus.ISSUED:
        await _move_stock(db, invoice, +1)
        await db.execute(delete(StockWithdrawal).where(StockWithdrawal.invoice_id == invoice.id))

    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    # Only a draft cancelled before issue: an issued invoice is an accounting
    # record to keep, and deleting the day's last number would hand it out again.
    if invoice.status != InvoiceStatus.CANCELLED or invoice.invoice_number is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only invoices cancelled before being issued can be deleted",
        )
    await db.delete(invoice)
    await db.commit()


@router.get("/{invoice_id}/pdf")
async def download_pdf(
    invoice_id: uuid.UUID,
    lang: Lang = Query("fr"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    filename = invoice.invoice_number or f"invoice-{invoice.id}"
    return await _pdf_response(invoice, None, filename, lang, current_user.tenant_id, db)


@router.post(
    "/{invoice_id}/reminders",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reminder(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    """Record the next payment reminder of an overdue invoice, dated today.

    Only this explicit step creates one: printing a reminder again never does.
    """
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    today = date.today()
    # Still payable on the due date itself: overdue starts the day after.
    overdue = invoice.due_date is not None and invoice.due_date < today
    if invoice.status != InvoiceStatus.ISSUED or not overdue:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only overdue invoices get a reminder")
    profile = await get_profile(db, current_user.tenant_id)
    invoice.reminders.append(
        InvoiceReminder(
            number=len(invoice.reminders) + 1,
            sent_on=today,
            due_on=today + timedelta(days=profile.reminder_terms_days),
        )
    )
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.get("/{invoice_id}/reminders/{number}/pdf")
async def download_reminder_pdf(
    invoice_id: uuid.UUID,
    number: int,
    lang: Lang = Query("fr"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)
    reminder = next((r for r in invoice.reminders if r.number == number), None)
    if reminder is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reminder not found")
    filename = f"{invoice.invoice_number}-R{number}"
    return await _pdf_response(invoice, reminder, filename, lang, current_user.tenant_id, db)


async def _pdf_response(
    invoice: Invoice,
    reminder: InvoiceReminder | None,
    filename: str,
    lang: Lang,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> Response:
    customer = await get_owned(db, Customer, invoice.customer_id, tenant_id)
    profile = await get_profile(db, tenant_id)
    pdf_bytes = generate_invoice_pdf(invoice, customer, profile, lang, reminder)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


# Compared through the column (`status == ...`) so the Enum type binds the stored
# name; a bare `case(value=...)` mapping would bind the raw value and never match.
_STATUS_RANK = {
    InvoiceStatus.DRAFT: 0,
    InvoiceStatus.ISSUED: 1,
    InvoiceStatus.PAID: 2,
    InvoiceStatus.CANCELLED: 3,
}


async def _validate_refs(
    body: InvoiceCreate | InvoiceUpdate, tenant_id: uuid.UUID, db: AsyncSession
) -> None:
    """Ensure the customer and every referenced article belong to the tenant."""
    customer = await db.scalar(
        select(Customer.id).where(Customer.id == body.customer_id, Customer.tenant_id == tenant_id)
    )
    if customer is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown customer: {body.customer_id}",
        )

    article_ids = {line.article_id for line in body.lines if line.article_id is not None}
    if article_ids:
        found = set(
            (
                await db.execute(
                    select(Article.id).where(
                        Article.id.in_(article_ids),
                        Article.tenant_id == tenant_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        missing = article_ids - found
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Unknown article(s): {', '.join(str(a) for a in missing)}",
            )


async def _load_invoice(invoice_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Invoice:
    return await get_owned(
        db,
        Invoice,
        invoice_id,
        tenant_id,
        selectinload(Invoice.lines),
        selectinload(Invoice.reminders),
    )


def _lines(body: InvoiceCreate | InvoiceUpdate) -> list[InvoiceLine]:
    """The lines in the order they were sent, which is how the invoice lists them."""
    return [InvoiceLine(**line.model_dump(), position=n) for n, line in enumerate(body.lines)]


async def _move_stock(db: AsyncSession, invoice: Invoice, sign: int) -> None:
    """Issuing takes the invoiced articles from the stock (-1), cancelling gives them back
    (+1): sold and offered alike, the offered ones also recorded as withdrawals."""
    quantities: dict[uuid.UUID, int] = {}
    for line in invoice.lines:
        if line.article_id is not None:
            quantities[line.article_id] = quantities.get(line.article_id, 0) + line.quantity
    if quantities:
        articles = select(Article).where(
            Article.tenant_id == invoice.tenant_id, Article.id.in_(quantities)
        )
        for article in await db.scalars(articles):
            article.stock_quantity += sign * quantities[article.id]


def _give_away(db: AsyncSession, invoice: Invoice) -> None:
    """The offered lines of an invoice being issued, as promotion withdrawals of its day:
    what the stock lost to them, outside the sales. _move_stock() already took them."""
    assert invoice.issue_date is not None
    db.add_all(
        StockWithdrawal(
            tenant_id=invoice.tenant_id,
            article_id=line.article_id,
            date=invoice.issue_date,
            quantity=line.quantity,
            reason=StockWithdrawalReason.PROMOTION,
            invoice_id=invoice.id,
        )
        for line in invoice.lines
        if line.offered and line.article_id is not None
    )
