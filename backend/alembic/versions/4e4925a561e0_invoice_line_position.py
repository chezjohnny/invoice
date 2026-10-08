"""invoice line position

The lines of an invoice in an order of their own, which the editor sets. They
used to sort by created_at, often the same second for a whole invoice. Existing
lines keep the order they showed in: created_at, then insertion order.

Revision ID: 4e4925a561e0
Revises: e9c64894fa05
Create Date: 2026-10-08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "4e4925a561e0"
down_revision: str | Sequence[str] | None = "e9c64894fa05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # A plain ADD COLUMN, not a batch copy of the table: the rowids, which break
    # created_at ties below, stay as they are.
    op.add_column(
        "invoice_lines",
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
    )
    op.execute(
        "UPDATE invoice_lines SET position = ranked.n FROM ("
        " SELECT id, row_number() OVER"
        " (PARTITION BY invoice_id ORDER BY created_at, rowid) - 1 AS n"
        " FROM invoice_lines) AS ranked"
        " WHERE ranked.id = invoice_lines.id"
    )
    op.create_index(
        "ix_invoice_lines_invoice_id_position", "invoice_lines", ["invoice_id", "position"]
    )


def downgrade() -> None:
    op.drop_index("ix_invoice_lines_invoice_id_position", table_name="invoice_lines")
    with op.batch_alter_table("invoice_lines") as batch_op:
        batch_op.drop_column("position")
