"""Invoice numbers: ``<YYMMDD><sequence>``, e.g. ``2610051``, the sequence restarting each day.

Digits only and short, because the customer types the number as the TWINT
message (and finds it in the e-banking communication): the shorter it is, the
more often it is actually typed.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invoice import Invoice


async def next_invoice_number(db: AsyncSession, tenant_id: uuid.UUID, day: date) -> str:
    # Six digits, so a stem only ever matches the numbers of its own day.
    stem = f"{day:%y%m%d}"
    numbers = await db.scalars(
        select(Invoice.invoice_number).where(
            Invoice.tenant_id == tenant_id,
            Invoice.invoice_number.startswith(stem, autoescape=True),
        )
    )
    # Imported references may carry letters ("5840pr"): only numeric ones count.
    used = [
        int(number[len(stem) :]) for number in numbers if number and number[len(stem) :].isdigit()
    ]
    return f"{stem}{max(used, default=0) + 1}"
