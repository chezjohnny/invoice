import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.stock_withdrawal import StockWithdrawalReason


class StockWithdrawalCreate(BaseModel):
    article_id: uuid.UUID
    date: dt.date
    quantity: int = Field(ge=1)
    reason: StockWithdrawalReason
    note: str = Field("", max_length=500)


class StockWithdrawalResponse(StockWithdrawalCreate):
    id: uuid.UUID
    article_name: str
    # Set when an invoice gave the articles away: it alone removes the withdrawal.
    invoice_id: uuid.UUID | None = None
    invoice_number: str | None = None

    model_config = ConfigDict(from_attributes=True)
