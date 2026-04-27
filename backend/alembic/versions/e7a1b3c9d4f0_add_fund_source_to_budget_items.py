"""add fund source to budget items

Revision ID: e7a1b3c9d4f0
Revises: d3e7b7a9c1f2
Create Date: 2026-04-27 12:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7a1b3c9d4f0"
down_revision: Union[str, None] = "d3e7b7a9c1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "budget_items",
        sa.Column(
            "fund_source",
            sa.String(length=50),
            nullable=False,
            server_default="general",
        ),
    )

    op.execute(
        """
        UPDATE budget_items
        SET fund_source = CASE number
            WHEN 1 THEN 'municipal'
            WHEN 2 THEN 'municipal'
            WHEN 3 THEN 'municipal'
            WHEN 4 THEN 'municipal'
            WHEN 6 THEN 'fiscal'
            WHEN 8 THEN 'fiscal'
            WHEN 9 THEN 'municipal'
            WHEN 10 THEN 'municipal'
            WHEN 11 THEN 'municipal'
            WHEN 12 THEN 'municipal'
            WHEN 13 THEN 'propio'
            WHEN 14 THEN 'propio'
            WHEN 15 THEN 'municipal'
            WHEN 16 THEN 'municipal'
            WHEN 18 THEN 'municipal'
            WHEN 19 THEN 'municipal'
            WHEN 20 THEN 'municipal'
            WHEN 21 THEN 'propio'
            WHEN 23 THEN 'municipal'
            WHEN 24 THEN 'propio'
            WHEN 25 THEN 'propio'
            WHEN 27 THEN 'propio'
            WHEN 28 THEN 'propio'
            WHEN 31 THEN 'fiscal'
            WHEN 32 THEN 'fiscal'
            WHEN 33 THEN 'fiscal'
            WHEN 34 THEN 'fiscal'
            WHEN 35 THEN 'municipal'
            WHEN 36 THEN 'fiscal'
            WHEN 37 THEN 'fiscal'
            WHEN 38 THEN 'fiscal'
            WHEN 39 THEN 'propio'
            WHEN 40 THEN 'propio'
            WHEN 41 THEN 'propio'
            WHEN 42 THEN 'propio'
            WHEN 45 THEN 'propio'
            ELSE 'general'
        END
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("budget_items", "fund_source")
