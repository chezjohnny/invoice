import uuid
from datetime import date, timedelta
from math import ceil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.article import Article
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import TenantProfile, User
from app.schemas.common import PagedResponse
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from app.services.pdf import generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=PagedResponse[InvoiceResponse])
async def list_invoices(
    search: str = Query(""),
    status_filter: str = Query("", alias="status"),
    customer_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = [Invoice.tenant_id == current_user.tenant_id]
    if customer_id:
        conditions.append(Invoice.customer_id == customer_id)
    if status_filter:
        try:
            conditions.append(Invoice.status == InvoiceStatus(status_filter))
        except ValueError:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Invalid status: {status_filter}"
            ) from None
    if search:
        conditions.append(Invoice.invoice_number.ilike(f"%{search}%"))

    total = (await db.scalar(select(func.count(Invoice.id)).where(*conditions))) or 0
    items = list(
        (
            await db.execute(
                select(Invoice)
                .where(*conditions)
                .options(selectinload(Invoice.lines))
                .order_by(Invoice.created_at.desc())
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        ).scalars().all()
    )
    pages = max(1, ceil(total / per_page)) if total else 1

    # Batch-load customer names for this page
    customer_ids = list({i.customer_id for i in items})
    cust_rows = (
        await db.execute(
            select(Customer.id, Customer.first_name, Customer.last_name)
            .where(Customer.id.in_(customer_ids))
        )
    ).all() if customer_ids else []
    names: dict[uuid.UUID, str] = {
        r.id: f"{r.last_name}, {r.first_name}" for r in cust_rows
    }

    response_items = [
        InvoiceResponse.model_validate(inv).model_copy(
            update={"customer_name": names.get(inv.customer_id, "")}
        )
        for inv in items
    ]
    return PagedResponse(
        items=response_items, total=total, page=page, per_page=per_page, pages=pages
    )


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
    )
    db.add(invoice)
    await db.flush()
    for line_data in body.lines:
        db.add(InvoiceLine(**line_data.model_dump(), invoice_id=invoice.id))
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _get_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft invoices can be edited")

    await _validate_refs(body, current_user.tenant_id, db)
    invoice.customer_id = body.customer_id
    invoice.discount_percent = body.discount_percent
    invoice.notes = body.notes

    existing = await db.execute(
        select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id)
    )
    for line in existing.scalars().all():
        await db.delete(line)
    await db.flush()

    for line_data in body.lines:
        db.add(InvoiceLine(**line_data.model_dump(), invoice_id=invoice.id))

    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
async def issue_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _get_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft invoices can be issued")

    profile_result = await db.execute(
        select(TenantProfile).where(TenantProfile.tenant_id == current_user.tenant_id)
    )
    profile = profile_result.scalar_one()

    today = date.today()
    invoice.invoice_number = (
        f"{profile.invoice_prefix}-{today.year}-{profile.invoice_next_number:04d}"
    )
    invoice.issue_date = today
    invoice.due_date = today + timedelta(days=profile.payment_terms_days)
    invoice.status = InvoiceStatus.ISSUED
    profile.invoice_next_number += 1

    lines_result = await db.execute(
        select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id)
    )
    for line in lines_result.scalars().all():
        if line.article_id is not None:
            art = (await db.execute(
                select(Article).where(Article.id == line.article_id)
            )).scalar_one_or_none()
            if art is not None:
                art.stock_quantity -= line.quantity

    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/pay", response_model=InvoiceResponse)
async def pay_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _get_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status != InvoiceStatus.ISSUED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only issued invoices can be paid")
    invoice.status = InvoiceStatus.PAID
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = await _get_invoice(invoice_id, current_user.tenant_id, db)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only draft or issued invoices can be cancelled",
        )

    if invoice.status == InvoiceStatus.ISSUED:
        lines_result = await db.execute(
            select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id)
        )
        for line in lines_result.scalars().all():
            if line.article_id is not None:
                art = (await db.execute(
                    select(Article).where(Article.id == line.article_id)
                )).scalar_one_or_none()
                if art is not None:
                    art.stock_quantity += line.quantity

    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()
    return await _load_invoice(invoice.id, current_user.tenant_id, db)


@router.get("/{invoice_id}/pdf")
async def download_pdf(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    invoice = await _load_invoice(invoice_id, current_user.tenant_id, db)

    customer_result = await db.execute(
        select(Customer).where(Customer.id == invoice.customer_id)
    )
    customer = customer_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found")

    profile_result = await db.execute(
        select(TenantProfile).where(TenantProfile.tenant_id == current_user.tenant_id)
    )
    profile = profile_result.scalar_one()

    pdf_bytes = generate_invoice_pdf(invoice, invoice.lines, customer, profile)
    filename = invoice.invoice_number or f"invoice-{invoice.id}"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


async def _validate_refs(
    body: InvoiceCreate | InvoiceUpdate, tenant_id: uuid.UUID, db: AsyncSession
) -> None:
    """Ensure the customer and every referenced article belong to the tenant."""
    customer = await db.scalar(
        select(Customer.id).where(
            Customer.id == body.customer_id, Customer.tenant_id == tenant_id
        )
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
            ).scalars().all()
        )
        missing = article_ids - found
        if missing:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Unknown article(s): {', '.join(str(a) for a in missing)}",
            )


async def _get_invoice(
    invoice_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Invoice:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return invoice


async def _load_invoice(
    invoice_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Invoice:
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id)
        .options(selectinload(Invoice.lines))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return invoice
