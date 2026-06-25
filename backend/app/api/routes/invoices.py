import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import TenantProfile, User
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from app.services.pdf import generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])


@router.get("", response_model=list[InvoiceResponse])
async def list_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Invoice]:
    result = await db.execute(
        select(Invoice)
        .where(Invoice.tenant_id == current_user.tenant_id)
        .options(selectinload(Invoice.lines))
        .order_by(Invoice.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Invoice:
    invoice = Invoice(
        tenant_id=current_user.tenant_id,
        customer_id=body.customer_id,
        currency=body.currency,
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

    invoice.customer_id = body.customer_id
    invoice.currency = body.currency
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
