from __future__ import annotations

from pydantic import BaseModel


class PagedResponse[T](BaseModel):
    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int
