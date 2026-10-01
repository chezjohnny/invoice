"""Accent- and case-insensitive word search, backed by a ``search_key`` SQLite function."""

from __future__ import annotations

import unicodedata
from collections.abc import Callable
from typing import Any

from sqlalchemy import ColumnElement, and_, func


def fold(value: str) -> str:
    """'Noir Désir' -> 'noir desir': SQLite's lower() and LIKE only fold ASCII."""
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def sqlite_search_key(value: str | None) -> str | None:
    """Registered on every SQLite connection as ``search_key()``."""
    return None if value is None else fold(value)


def contains(column: Any, pattern: str) -> ColumnElement[bool]:
    return func.search_key(column).like(pattern, escape="\\")


def matches_words(
    search: str, condition: Callable[[str], ColumnElement[bool]]
) -> ColumnElement[bool]:
    """Every word of ``search`` must satisfy ``condition(pattern)``, in any order."""
    patterns = [
        "%" + fold(word).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        for word in search.split()
    ]
    return and_(*(condition(pattern) for pattern in patterns))
