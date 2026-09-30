from collections.abc import Sequence
from typing import Any, Literal

from sqlalchemy import ColumnElement, UnaryExpression
from sqlalchemy.orm import QueryableAttribute

SortOrder = Literal["asc", "desc"]
SortColumn = ColumnElement[Any] | QueryableAttribute[Any]


def sort_clauses(columns: Sequence[SortColumn], order: SortOrder) -> list[UnaryExpression[Any]]:
    # Empty values last in both directions: a draft without a number, or a
    # customer without an email, never tops the list.
    return [(c.asc() if order == "asc" else c.desc()).nulls_last() for c in columns]
