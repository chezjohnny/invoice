import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import get_owned, set_archived
from app.api.deps import get_current_user
from app.api.responses import csv_response
from app.api.sorting import SortColumn, SortOrder, sort_clauses
from app.core.database import get_db
from app.core.search import contains, matches_words, phone_query
from app.models.customer import Customer
from app.models.tenant import User
from app.schemas.common import PagedResponse
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate

router = APIRouter(prefix="/customers", tags=["customers"])

CustomerSort = Literal["name", "email", "city"]


@router.get("", response_model=PagedResponse[CustomerResponse])
async def list_customers(
    search: str = Query(""),
    archived: bool = Query(False),
    sort: CustomerSort | None = Query(None),
    order: SortOrder = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[CustomerResponse]:
    if sort is None:
        ordering: list[SortColumn] = [Customer.created_at.desc(), Customer.id.desc()]
    else:
        columns: dict[str, list[SortColumn]] = {
            "name": [func.lower(Customer.last_name), func.lower(Customer.first_name)],
            "email": [func.lower(Customer.email)],
            "city": [func.lower(Customer.city), Customer.postal_code],
        }
        ordering = [*sort_clauses(columns[sort], order), Customer.id]

    conditions = [
        Customer.tenant_id == current_user.tenant_id,
        Customer.is_archived.is_(archived),
    ]
    if digits := phone_query(search):
        # A caller's number, written any way: '079 123 45 67', '+41791234567'…
        conditions.append(func.phone_key(Customer.phones).like(f"%{digits}%"))
    elif search:
        conditions.append(
            matches_words(
                search,
                lambda pattern: or_(
                    contains(Customer.last_name, pattern),
                    contains(Customer.first_name, pattern),
                    contains(Customer.email, pattern),
                ),
            )
        )

    total = (await db.scalar(select(func.count(Customer.id)).where(*conditions))) or 0
    items = list(
        (
            await db.execute(
                select(Customer)
                .where(*conditions)
                .order_by(*ordering)
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )
        .scalars()
        .all()
    )
    return PagedResponse.build(
        [CustomerResponse.model_validate(c) for c in items], total, page, per_page
    )


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

    return csv_response(
        [
            "first_name",
            "last_name",
            "email",
            "address_line1",
            "address_line2",
            "postal_code",
            "city",
            "country",
        ],
        (
            [
                c.first_name,
                c.last_name,
                c.email or "",
                c.address_line1,
                c.address_line2 or "",
                c.postal_code,
                c.city,
                c.country,
            ]
            for c in customers
        ),
        "customers.csv",
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    return await _get_customer(customer_id, current_user.tenant_id, db)


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
    return await set_archived(db, customer, archived=True)


@router.patch("/{customer_id}/restore", response_model=CustomerResponse)
async def restore_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = await _get_customer(customer_id, current_user.tenant_id, db)
    return await set_archived(db, customer, archived=False)


async def _get_customer(customer_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Customer:
    return await get_owned(db, Customer, customer_id, tenant_id)
