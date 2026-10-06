import csv
import io
from collections.abc import Iterable
from typing import Any

from fastapi import Response

# A cell starting like this is run as a formula by Excel or LibreOffice: a
# customer named "=HYPERLINK(...)" must stay text in an export.
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _safe(value: Any) -> Any:
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


def csv_response(header: list[str], rows: Iterable[Iterable[Any]], filename: str) -> Response:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    writer.writerows([_safe(value) for value in row] for row in rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
