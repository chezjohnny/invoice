import datetime as dt
import enum
import uuid

from sqlalchemy import Date, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import UUIDBase


class StockWithdrawalReason(enum.StrEnum):
    TASTING = "tasting"
    PROMOTION = "promotion"
    LOSS = "loss"
    OTHER = "other"


class StockWithdrawal(UUIDBase):
    """Articles leaving the stock without being invoiced."""

    __tablename__ = "stock_withdrawals"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    article_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("articles.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[StockWithdrawalReason] = mapped_column(
        SAEnum(StockWithdrawalReason, name="stock_withdrawal_reason"), nullable=False
    )
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
