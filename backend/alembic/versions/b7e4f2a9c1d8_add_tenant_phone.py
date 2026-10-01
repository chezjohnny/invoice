"""add tenant phone

Revision ID: b7e4f2a9c1d8
Revises: 5d2b8e4f1a63
Create Date: 2026-10-01 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e4f2a9c1d8'
down_revision: Union[str, Sequence[str], None] = '5d2b8e4f1a63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tenant_profiles', sa.Column('phone', sa.String(length=16), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('tenant_profiles') as batch_op:
        batch_op.drop_column('phone')
