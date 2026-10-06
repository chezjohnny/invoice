import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import ScalarSelect, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import get_owned, set_archived
from app.api.deps import get_current_user
from app.api.responses import csv_response
from app.api.sorting import SortColumn, SortOrder, sort_clauses
from app.core.database import get_db
from app.core.search import contains, matches_words
from app.models.article import Article
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.stock_withdrawal import StockWithdrawal
from app.models.tenant import User
from app.schemas.article import ArticleCreate, ArticleListItem, ArticleResponse, ArticleUpdate
from app.schemas.common import PagedResponse

router = APIRouter(prefix="/articles", tags=["articles"])

# Same rule as the stock: an issued invoice consumes it, a cancelled one gives it back.
_SOLD_STATUSES = (InvoiceStatus.ISSUED, InvoiceStatus.PAID)

ArticleSort = Literal[
    "name",
    "description",
    "unit_price",
    "vat_rate_override",
    "stock_quantity",
    "sold_quantity",
    "withdrawn_quantity",
]


@router.get("", response_model=PagedResponse[ArticleListItem])
async def list_articles(
    search: str = Query(""),
    archived: bool = Query(False),
    sales_year: int | None = Query(None, ge=1900, le=9999),
    sales_quarter: int | None = Query(None, ge=1, le=4),
    sort: ArticleSort | None = Query(None),
    order: SortOrder = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[ArticleListItem]:
    _check_period(sales_year, sales_quarter)
    conditions = [
        Article.tenant_id == current_user.tenant_id,
        Article.is_archived.is_(archived),
    ]
    if search:
        conditions.append(matches_words(search, lambda pattern: contains(Article.name, pattern)))

    sold = _sold_quantity(sales_year, sales_quarter).label("sold_quantity")
    withdrawn = _withdrawn_quantity(sales_year, sales_quarter).label("withdrawn_quantity")
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
            "withdrawn_quantity": [withdrawn],
        }
        ordering = [*sort_clauses(columns[sort], order), Article.id]

    total = (await db.scalar(select(func.count(Article.id)).where(*conditions))) or 0
    rows = (
        await db.execute(
            select(Article, sold, withdrawn)
            .where(*conditions)
            .order_by(*ordering)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
    ).all()
    items = [
        ArticleListItem(
            **ArticleResponse.model_validate(article).model_dump(),
            sold_quantity=sold,
            withdrawn_quantity=withdrawn,
        )
        for article, sold, withdrawn in rows
    ]
    return PagedResponse.build(items, total, page, per_page)


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


@router.get("/export.csv")
async def export_articles_csv(
    archived: bool = Query(False),
    sales_year: int | None = Query(None, ge=1900, le=9999),
    sales_quarter: int | None = Query(None, ge=1, le=4),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """The active (or archived) articles, with their sales and withdrawals over the period."""
    _check_period(sales_year, sales_quarter)
    rows = (
        await db.execute(
            select(
                Article,
                _sold_quantity(sales_year, sales_quarter),
                _withdrawn_quantity(sales_year, sales_quarter),
            )
            .where(Article.tenant_id == current_user.tenant_id, Article.is_archived.is_(archived))
            .order_by(func.lower(Article.name), Article.id)
        )
    ).all()

    name = "articles-archived" if archived else "articles"
    if sales_year is not None:
        name += f"-{sales_year}" + ("" if sales_quarter is None else f"-Q{sales_quarter}")
    return csv_response(
        [
            "name",
            "description",
            "unit_price",
            "vat_rate",
            "stock_quantity",
            "sold_quantity",
            "withdrawn_quantity",
        ],
        (
            [
                article.name,
                article.description,
                article.unit_price,
                "" if article.vat_rate_override is None else article.vat_rate_override,
                article.stock_quantity,
                sold,
                withdrawn,
            ]
            for article, sold, withdrawn in rows
        ),
        f"{name}.csv",
    )


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    return await _get_article(article_id, current_user.tenant_id, db)


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
    return await set_archived(db, article, archived=True)


@router.patch("/{article_id}/restore", response_model=ArticleResponse)
async def restore_article(
    article_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Article:
    article = await _get_article(article_id, current_user.tenant_id, db)
    return await set_archived(db, article, archived=False)


def _sold_quantity(sales_year: int | None, sales_quarter: int | None) -> ScalarSelect[int]:
    query = (
        select(func.coalesce(func.sum(InvoiceLine.quantity), 0))
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .where(InvoiceLine.article_id == Article.id, Invoice.status.in_(_SOLD_STATUSES))
    )
    if sales_year is not None:
        # A range rather than extract(year) so the comparison stays index-friendly.
        start, end = _sales_period(sales_year, sales_quarter)
        query = query.where(Invoice.issue_date >= start, Invoice.issue_date < end)
    return query.scalar_subquery()


def _check_period(sales_year: int | None, sales_quarter: int | None) -> None:
    if sales_quarter is not None and sales_year is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "sales_quarter requires sales_year"
        )


def _withdrawn_quantity(sales_year: int | None, sales_quarter: int | None) -> ScalarSelect[int]:
    query = select(func.coalesce(func.sum(StockWithdrawal.quantity), 0)).where(
        StockWithdrawal.article_id == Article.id
    )
    if sales_year is not None:
        start, end = _sales_period(sales_year, sales_quarter)
        query = query.where(StockWithdrawal.date >= start, StockWithdrawal.date < end)
    return query.scalar_subquery()


def _sales_period(year: int, quarter: int | None) -> tuple[date, date]:
    """Half-open [start, end) range of the year, or of one of its quarters."""
    if quarter is None:
        return date(year, 1, 1), date(year + 1, 1, 1)
    start = date(year, 3 * quarter - 2, 1)
    end = date(year + 1, 1, 1) if quarter == 4 else date(year, 3 * quarter + 1, 1)
    return start, end


async def _get_article(article_id: uuid.UUID, tenant_id: uuid.UUID, db: AsyncSession) -> Article:
    return await get_owned(db, Article, article_id, tenant_id)
