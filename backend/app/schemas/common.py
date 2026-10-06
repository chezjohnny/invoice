from math import ceil
from typing import Self

from pydantic import BaseModel


class PagedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, per_page: int) -> Self:
        return cls(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            pages=ceil(total / per_page) if total else 1,
        )
