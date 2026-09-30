"""add tenant twint phone

Revision ID: a3c9e1d27f40
Revises: 3c8a7d1e9f42
Create Date: 2026-09-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c9e1d27f40'
down_revision: Union[str, Sequence[str], None] = '3c8a7d1e9f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tenant_profiles', sa.Column('twint_phone', sa.String(length=12), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('tenant_profiles') as batch_op:
        batch_op.drop_column('twint_phone')
