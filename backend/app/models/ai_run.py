import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiRun(Base):
    __tablename__ = "ai_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="iniciado")
    intent: Mapped[str] = mapped_column(String(50), nullable=False, default="overview")
    input_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    user_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    domain_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    policy_context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    tool_calls: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    findings: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    proposed_actions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    human_review: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    final_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_trace: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
