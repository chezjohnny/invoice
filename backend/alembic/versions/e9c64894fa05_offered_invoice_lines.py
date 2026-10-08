"""offered invoice lines

An invoice line can be given away (offered): on issue it becomes a promotion
stock withdrawal linked to its invoice, instead of a sale.

Revision ID: e9c64894fa05
Revises: c4e70294bd4a
Create Date: 2026-10-08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e9c64894fa05"
down_revision: str | Sequence[str] | None = "c4e70294bd4a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_FK = "fk_stock_withdrawals_invoice_id_invoices"


def upgrade() -> None:
    with op.batch_alter_table("invoice_lines") as batch_op:
        batch_op.add_column(
            sa.Column("offered", sa.Boolean(), server_default=sa.false(), nullable=False)
        )

    with op.batch_alter_table("stock_withdrawals") as batch_op:
        batch_op.add_column(sa.Column("invoice_id", sa.Uuid(), nullable=True))
        batch_op.create_index("ix_stock_withdrawals_invoice_id", ["invoice_id"])
        batch_op.create_foreign_key(_FK, "invoices", ["invoice_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    with op.batch_alter_table("stock_withdrawals") as batch_op:
        batch_op.drop_constraint(_FK, type_="foreignkey")
        batch_op.drop_index("ix_stock_withdrawals_invoice_id")
        batch_op.drop_column("invoice_id")

    with op.batch_alter_table("invoice_lines") as batch_op:
        batch_op.drop_column("offered")
