import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import get_owned
from app.api.deps import get_current_user
from app.api.sorting import SortColumn, SortOrder, sort_clauses
from app.core.database import get_db
from app.core.search import contains, matches_words
from app.models.article import Article
from app.models.invoice import Invoice
from app.models.stock_withdrawal import StockWithdrawal, StockWithdrawalReason
from app.models.tenant import User
from app.schemas.common import PagedResponse
from app.schemas.stock_withdrawal import StockWithdrawalCreate, StockWithdrawalResponse

router = APIRouter(prefix="/stock-withdrawals", tags=["stock-withdrawals"])

StockWithdrawalSort = Literal["date", "article", "quantity", "reason"]


@router.get("", response_model=PagedResponse[StockWithdrawalResponse])
async def list_stock_withdrawals(
    search: str = Query(""),
    reason: StockWithdrawalReason | None = Query(None),
    article_id: uuid.UUID | None = Query(None),
    sort: StockWithdrawalSort | None = Query(None),
    order: SortOrder = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[StockWithdrawalResponse]:
    if sort is None:
        ordering: list[SortColumn] = [
            StockWithdrawal.date.desc(),
            StockWithdrawal.created_at.desc(),
            StockWithdrawal.id,
        ]
    else:
        columns: dict[str, list[SortColumn]] = {
            "date": [StockWithdrawal.date, StockWithdrawal.created_at],
            "article": [func.lower(Article.name)],
            "quantity": [StockWithdrawal.quantity],
            "reason": [StockWithdrawal.reason],
        }
        ordering = [*sort_clauses(columns[sort], order), StockWithdrawal.id]

    conditions = [StockWithdrawal.tenant_id == current_user.tenant_id]
    if search:
        conditions.append(matches_words(search, lambda pattern: contains(Article.name, pattern)))
    if reason is not None:
        conditions.append(StockWithdrawal.reason == reason)
    if article_id is not None:
        conditions.append(StockWithdrawal.article_id == article_id)

    base = (
        select(StockWithdrawal, Article.name, Invoice.invoice_number)
        .join(Article, Article.id == StockWithdrawal.article_id)
        .outerjoin(Invoice, Invoice.id == StockWithdrawal.invoice_id)
        .where(*conditions)
    )
    total = (await db.scalar(select(func.count()).select_from(base.subquery()))) or 0
    rows = (
        await db.execute(base.order_by(*ordering).offset((page - 1) * per_page).limit(per_page))
    ).all()
    items = [_response(withdrawal, name, number) for withdrawal, name, number in rows]
    return PagedResponse.build(items, total, page, per_page)


@router.post("", response_model=StockWithdrawalResponse, status_code=status.HTTP_201_CREATED)
async def create_stock_withdrawal(
    body: StockWithdrawalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StockWithdrawalResponse:
    article = await get_owned(db, Article, body.article_id, current_user.tenant_id)
    withdrawal = StockWithdrawal(**body.model_dump(), tenant_id=current_user.tenant_id)
    db.add(withdrawal)
    # Same rule as an issued invoice: the stock may go negative, flagged in the UI.
    article.stock_quantity -= body.quantity
    await db.commit()
    await db.refresh(withdrawal)
    return _response(withdrawal, article.name)


@router.delete("/{withdrawal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock_withdrawal(
    withdrawal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    withdrawal = await get_owned(db, StockWithdrawal, withdrawal_id, current_user.tenant_id)
    if withdrawal.invoice_id is not None:
        # The invoice still prints the articles as offered: cancelling it removes this.
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Withdrawn by an invoice: cancel the invoice instead"
        )
    article = await get_owned(db, Article, withdrawal.article_id, current_user.tenant_id)
    article.stock_quantity += withdrawal.quantity
    await db.delete(withdrawal)
    await db.commit()


def _response(
    withdrawal: StockWithdrawal, article_name: str, invoice_number: str | None = None
) -> StockWithdrawalResponse:
    return StockWithdrawalResponse(
        id=withdrawal.id,
        article_id=withdrawal.article_id,
        article_name=article_name,
        date=withdrawal.date,
        quantity=withdrawal.quantity,
        reason=withdrawal.reason,
        note=withdrawal.note,
        invoice_id=withdrawal.invoice_id,
        invoice_number=invoice_number,
    )
