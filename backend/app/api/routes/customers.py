import csv
import io
import uuid
from math import ceil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.customer import Customer
from app.models.tenant import User
from app.schemas.common import PagedResponse
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=PagedResponse[CustomerResponse])
async def list_customers(
    search: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = [
        Customer.tenant_id == current_user.tenant_id,
        Customer.is_archived.is_(False),
    ]
    if search:
        conditions.append(
            or_(
                Customer.last_name.ilike(f"%{search}%"),
                Customer.first_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
            )
        )

    total = (await db.scalar(select(func.count(Customer.id)).where(*conditions))) or 0
    items = list(
        (
            await db.execute(
                select(Customer)
                .where(*conditions)
                .order_by(Customer.last_name, Customer.first_name)
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        ).scalars().all()
    )
    pages = max(1, ceil(total / per_page)) if total else 1
    return PagedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/export.csv")
async def export_customers_csv(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(Customer)
        .where(Customer.tenant_id == current_user.tenant_id, Customer.is_archived.is_(False))
        .order_by(Customer.last_name, Customer.first_name)
    )
    customers = list(result.scalars().all())

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["first_name", "last_name", "email", "address_line1", "postal_code", "city", "country"]
    )
    for c in customers:
        writer.writerow(
            [c.first_name, c.last_name, c.email or "",
             c.address_line1, c.postal_code, c.city, c.country]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=customers.csv"},
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = Customer(**body.model_dump(), tenant_id=current_user.tenant_id)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: uuid.UUID,
    body: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = await _get_customer(customer_id, current_user.tenant_id, db)
    for field, value in body.model_dump().items():
        setattr(customer, field, value)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.patch("/{customer_id}/archive", response_model=CustomerResponse)
async def archive_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = await _get_customer(customer_id, current_user.tenant_id, db)
    customer.is_archived = True
    await db.commit()
    await db.refresh(customer)
    return customer


async def _get_customer(
    customer_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Customer:
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer
