"""Invoice numbers: ``<prefix>-<YYYYMMDD>-<sequence>``, the sequence restarting each day."""

from __future__ import annotations

import re
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice

_LEGACY_REFERENCE_RE = re.compile(r"^(?P<day>\d{8})(?P<sequence>.+)$")


def from_reference(prefix: str, reference: str) -> str:
    """Turn a paper/legacy reference such as ``202512205763`` into ``FAC-20251220-5763``.

    The digits are kept as printed, even when they disagree with the invoice date:
    the number is what the customer has on paper.
    """
    match = _LEGACY_REFERENCE_RE.match(reference)
    if match is None:
        return reference
    return f"{prefix}-{match['day']}-{match['sequence']}"


async def next_invoice_number(
    db: AsyncSession, tenant_id: uuid.UUID, prefix: str, day: date
) -> str:
    stem = f"{prefix}-{day:%Y%m%d}-"
    numbers = await db.scalars(
        select(Invoice.invoice_number).where(
            Invoice.tenant_id == tenant_id,
            Invoice.invoice_number.startswith(stem, autoescape=True),
        )
    )
    # Imported references may carry letters ("5840pr"): only numeric ones count.
    used = [
        int(number[len(stem):]) for number in numbers if number and number[len(stem):].isdigit()
    ]
    return f"{stem}{max(used, default=0) + 1:04d}"
