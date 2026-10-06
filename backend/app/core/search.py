"""Accent- and case-insensitive word search, and phone number search, backed by the
``search_key`` and ``phone_key`` SQLite functions."""

from __future__ import annotations

import json
import re
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


def phone_digits(value: str) -> str:
    """'+41 79 123 45 67', '0041791234567' and '079 123 45 67' -> '0791234567'."""
    digits = re.sub(r"\D", "", value)
    if value.strip().startswith("+"):
        digits = "00" + digits
    return "0" + digits[4:] if digits.startswith("0041") else digits


def sqlite_phone_key(phones: str | None) -> str | None:
    """Registered as ``phone_key()``: a customer's JSON phone list, as national digits."""
    if phones is None:
        return None
    return " ".join(phone_digits(str(p.get("number", ""))) for p in json.loads(phones))


# Digits with the usual separators, and at least three digits: a phone number
# (or the end of one), never a name.
_PHONE_QUERY = re.compile(r"^\+?[\d\s().\-/]*$")


def phone_query(search: str) -> str | None:
    """The digits to look for when ``search`` is a phone number, else None."""
    if not _PHONE_QUERY.match(search.strip()):
        return None
    digits = phone_digits(search)
    return digits if len(digits) >= 3 else None


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
