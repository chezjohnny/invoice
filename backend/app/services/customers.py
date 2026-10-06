import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer


def display_name(first_name: str, last_name: str) -> str:
    """'Dupont, Jean': how a customer is listed; a company has no first name."""
    return ", ".join(part for part in (last_name, first_name) if part)


def full_name(customer: Customer) -> str:
    """'Jean Dupont': how a customer is addressed."""
    return " ".join(part for part in (customer.first_name, customer.last_name) if part)


async def customer_names(db: AsyncSession, ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Display names of these customers, in one query."""
    wanted = set(ids)
    if not wanted:
        return {}
    rows = await db.execute(
        select(Customer.id, Customer.first_name, Customer.last_name).where(Customer.id.in_(wanted))
    )
    return {row.id: display_name(row.first_name, row.last_name) for row in rows}
