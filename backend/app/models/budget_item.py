import uuid

from sqlalchemy import Boolean, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_year_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fiscal_years.id"), nullable=False)
    number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    authority: Mapped[str] = mapped_column(String(20), nullable=False)
    allocated_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    executed_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    yellow_threshold: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=80.00)
    red_threshold: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=100.00)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    fiscal_year = relationship("FiscalYear", lazy="selectin")

    __table_args__ = (
        {"extend_existing": True},
    )
