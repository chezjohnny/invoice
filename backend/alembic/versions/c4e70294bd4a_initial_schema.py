"""initial schema (v1.0)

The whole schema in one revision. It keeps the id of the last revision before
1.0, so that databases created by the earlier migrations are already at head.

Revision ID: c4e70294bd4a
Revises:
Create Date: 2026-10-06

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4e70294bd4a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("subdomain", sa.String(length=63), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subdomain"),
    )
    op.create_table(
        "articles",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("vat_rate_override", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "customers",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("address_line1", sa.String(length=200), nullable=False),
        sa.Column("address_line2", sa.String(length=200), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("phones", sa.JSON(), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "tenant_profiles",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("address_line1", sa.String(length=255), nullable=False),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=False),
        sa.Column("iban", sa.String(length=34), nullable=True),
        sa.Column("twint_phone", sa.String(length=12), nullable=True),
        sa.Column("phone", sa.String(length=16), nullable=True),
        sa.Column("vat_number", sa.String(length=20), nullable=True),
        sa.Column("default_vat_rate", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("payment_terms_days", sa.Integer(), nullable=False),
        sa.Column("reminder_terms_days", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id"),
    )
    op.create_table(
        "users",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("token_version", sa.Integer(), server_default="0", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "invoices",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("invoice_number", sa.String(length=50), nullable=True),
        sa.Column(
            "status",
            sa.Enum("DRAFT", "ISSUED", "PAID", "CANCELLED", name="invoice_status"),
            nullable=False,
        ),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.Date(), nullable=True),
        sa.Column(
            "payment_method", sa.Enum("CASH", "TWINT", "IBAN", name="payment_method"), nullable=True
        ),
        sa.Column("discount_percent", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("notes", sa.String(length=1000), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "stock_withdrawals",
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column(
            "reason",
            sa.Enum("TASTING", "PROMOTION", "LOSS", "OTHER", name="stock_withdrawal_reason"),
            nullable=False,
        ),
        sa.Column("note", sa.String(length=500), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("stock_withdrawals") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_stock_withdrawals_article_id"), ["article_id"], unique=False
        )

    op.create_table(
        "invoice_lines",
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("article_id", sa.Uuid(), nullable=True),
        sa.Column("description_snapshot", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_snapshot", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("vat_rate_snapshot", sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["article_id"], ["articles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("invoice_lines") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_invoice_lines_article_id"), ["article_id"], unique=False
        )

    op.create_table(
        "invoice_reminders",
        sa.Column("invoice_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("sent_on", sa.Date(), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_id", "number"),
    )
    with op.batch_alter_table("invoice_reminders") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_invoice_reminders_invoice_id"), ["invoice_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("invoice_reminders") as batch_op:
        batch_op.drop_index(batch_op.f("ix_invoice_reminders_invoice_id"))

    op.drop_table("invoice_reminders")
    with op.batch_alter_table("invoice_lines") as batch_op:
        batch_op.drop_index(batch_op.f("ix_invoice_lines_article_id"))

    op.drop_table("invoice_lines")
    with op.batch_alter_table("stock_withdrawals") as batch_op:
        batch_op.drop_index(batch_op.f("ix_stock_withdrawals_article_id"))

    op.drop_table("stock_withdrawals")
    op.drop_table("invoices")
    op.drop_table("users")
    op.drop_table("tenant_profiles")
    op.drop_table("customers")
    op.drop_table("articles")
    op.drop_table("tenants")
