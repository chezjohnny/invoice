"""add customer address line 2

Revision ID: c3d9a1f7e2b5
Revises: b7e4f2a9c1d8
Create Date: 2026-10-01 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d9a1f7e2b5'
down_revision: Union[str, Sequence[str], None] = 'b7e4f2a9c1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('customers', sa.Column('address_line2', sa.String(length=200), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('customers') as batch_op:
        batch_op.drop_column('address_line2')
