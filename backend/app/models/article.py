import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import UUIDBase


class Article(UUIDBase):
    __tablename__ = "articles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    vat_rate_override: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
