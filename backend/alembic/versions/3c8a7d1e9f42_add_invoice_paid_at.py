"""add invoice payment date

Revision ID: 3c8a7d1e9f42
Revises: fb4f3866617b
Create Date: 2026-09-29

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3c8a7d1e9f42"
down_revision: str | Sequence[str] | None = "fb4f3866617b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("paid_at", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("invoices", "paid_at")