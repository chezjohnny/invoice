import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ArticleBase(BaseModel):
    name: str
    description: str = ""
    unit_price: Decimal = Field(ge=0)
    vat_rate_override: Decimal | None = Field(None, ge=0, le=1)
    stock_quantity: int = 0


class ArticleCreate(ArticleBase):
    pass


class ArticleUpdate(ArticleBase):
    pass


class ArticleResponse(ArticleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    is_archived: bool

    model_config = ConfigDict(from_attributes=True)


class ArticleListItem(ArticleResponse):
    # Computed on read, never stored: from issued and paid invoice lines, and
    # from stock withdrawals (tasting, promotion, loss…) for what left unbilled.
    sold_quantity: int
    withdrawn_quantity: int
