"""link assets to acquisition expenses

Revision ID: f2b8c6d1a905
Revises: e7a1b3c9d4f0
Create Date: 2026-04-27 12:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2b8c6d1a905"
down_revision: Union[str, None] = "e7a1b3c9d4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("assets", sa.Column("acquisition_expense_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "assets_acquisition_expense_id_fkey",
        "assets",
        "expenses",
        ["acquisition_expense_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("assets_acquisition_expense_id_fkey", "assets", type_="foreignkey")
    op.drop_column("assets", "acquisition_expense_id")
