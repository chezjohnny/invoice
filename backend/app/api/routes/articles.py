import uuid
from datetime import date
from math import ceil
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import ScalarSelect, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.sorting import SortColumn, SortOrder, sort_clauses
from app.core.database import get_db
from app.models.article import Article
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.tenant import User
from app.schemas.article import ArticleCreate, ArticleListItem, ArticleResponse, ArticleUpdate
from app.schemas.common import PagedResponse

router = APIRouter(prefix="/articles", tags=["articles"])

# Same rule as the stock: an issued invoice consumes it, a cancelled one gives it back.
_SOLD_STATUSES = (InvoiceStatus.ISSUED, InvoiceStatus.PAID)

ArticleSort = Literal[
    "name", "description", "unit_price", "vat_rate_override", "stock_quantity", "sold_quantity"
]


@router.get("", response_model=PagedResponse[ArticleListItem])
async def list_articles(
    search: str = Query(""),
    archived: bool = Query(False),
    sales_year: int | None = Query(None, ge=1900, le=9999),
    sort: ArticleSort | None = Query(None),
    order: SortOrder = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    conditions = [
        Article.tenant_id == current_user.tenant_id,
        Article.is_archived.is_(archived),
    ]
    if search:
        conditions.append(Article.name.ilike(f"%{search}%"))

    sold = _sold_quantity(sales_year).label("sold_quantity")
    if sort is None:
        ordering: list[SortColumn] = [Article.created_at.desc(), Article.id.desc()]
    else:
        columns: dict[str, list[SortColumn]] = {
            "name": [func.lower(Article.name)],
            "description": [func.lower(Article.description)],
            "unit_price": [Article.unit_price],
            "vat_rate_override": [Article.vat_rate_override],
            "stock_quantity": [Article.stock_quantity],
            "sold_quantity": [sold],
        }
        ordering = [*sort_clauses(columns[sort], order), Article.id]

    total = (await db.scalar(select(func.count(Article.id)).where(*conditions))) or 0
    rows = (
        await db.execute(
            select(Article, sold)
            .where(*conditions)
            .order_by(*ordering)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).all()
    items = [
        ArticleListItem(
            **ArticleResponse.model_validate(article).model_dump(), sold_quantity=sold
        )
        for article, sold in rows
    ]
    pages = max(1, ceil(total / per_page)) if total else 1
    return PagedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/sales-years", response_model=list[int])
async def list_sales_years(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[int]:
    year = extract("year", Invoice.issue_date)
    result = await db.scalars(
        select(year)
        .where(
            Invoice.tenant_id == current_user.tenant_id,
            Invoice.status.in_(_SOLD_STATUSES),
            Invoice.issue_date.is_not(None),
        )
        .distinct()
        .order_by(year.desc())
    )
    return [int(y) for y in result]


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    body: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = Article(**body.model_dump(), tenant_id=current_user.tenant_id)
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: uuid.UUID,
    body: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    for field, value in body.model_dump().items():
        setattr(article, field, value)
    await db.commit()
    await db.refresh(article)
    return article


@router.patch("/{article_id}/archive", response_model=ArticleResponse)
async def archive_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    article.is_archived = True
    await db.commit()
    await db.refresh(article)
    return article


@router.patch("/{article_id}/restore", response_model=ArticleResponse)
async def restore_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    article.is_archived = False
    await db.commit()
    await db.refresh(article)
    return article


def _sold_quantity(sales_year: int | None) -> ScalarSelect[int]:
    query = (
        select(func.coalesce(func.sum(InvoiceLine.quantity), 0))
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .where(InvoiceLine.article_id == Article.id, Invoice.status.in_(_SOLD_STATUSES))
    )
    if sales_year is not None:
        # A range rather than extract(year) so the comparison stays index-friendly.
        query = query.where(
            Invoice.issue_date >= date(sales_year, 1, 1),
            Invoice.issue_date < date(sales_year + 1, 1, 1),
        )
    return query.scalar_subquery()


async def _get_article(
    article_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession
) -> Article:
    result = await db.execute(
        select(Article).where(Article.id == article_id, Article.tenant_id == tenant_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article
