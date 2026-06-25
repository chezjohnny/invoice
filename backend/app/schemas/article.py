import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ArticleBase(BaseModel):
    name: str
    description: str = ""
    unit_price: Decimal
    vat_rate_override: Decimal | None = None
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
