"""add ai runs table

Revision ID: d3e7b7a9c1f2
Revises: 9f63d5e8127a
Create Date: 2026-04-27 01:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d3e7b7a9c1f2"
down_revision: Union[str, None] = "9f63d5e8127a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "ai_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("thread_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("intent", sa.String(length=50), nullable=False),
        sa.Column("input_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("user_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("domain_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("policy_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("tool_calls", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("findings", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("proposed_actions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("human_review", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("final_response", sa.Text(), nullable=True),
        sa.Column("audit_trace", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_runs_thread_id", "ai_runs", ["thread_id"])
    op.create_index("ix_ai_runs_user_id", "ai_runs", ["user_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_ai_runs_user_id", table_name="ai_runs")
    op.drop_index("ix_ai_runs_thread_id", table_name="ai_runs")
    op.drop_table("ai_runs")
