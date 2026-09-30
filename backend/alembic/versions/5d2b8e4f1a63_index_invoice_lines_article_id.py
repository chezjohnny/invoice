"""index invoice_lines.article_id

Revision ID: 5d2b8e4f1a63
Revises: a3c9e1d27f40
Create Date: 2026-09-30 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '5d2b8e4f1a63'
down_revision: Union[str, Sequence[str], None] = 'a3c9e1d27f40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite does not index foreign keys: the articles list sums sold lines per article.
    op.create_index('ix_invoice_lines_article_id', 'invoice_lines', ['article_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_invoice_lines_article_id', table_name='invoice_lines')
