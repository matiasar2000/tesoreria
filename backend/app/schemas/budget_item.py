import uuid

from pydantic import BaseModel, computed_field


class BudgetItemUpdate(BaseModel):
    allocated_amount: float | None = None
    yellow_threshold: float | None = None
    red_threshold: float | None = None


class BudgetItemResponse(BaseModel):
    id: uuid.UUID
    fiscal_year_id: uuid.UUID
    number: int
    name: str
    authority: str
    allocated_amount: float
    executed_amount: float
    yellow_threshold: float
    red_threshold: float
    is_blocked: bool

    @computed_field
    @property
    def available_amount(self) -> float:
        return self.allocated_amount - self.executed_amount

    @computed_field
    @property
    def execution_percentage(self) -> float:
        if self.allocated_amount == 0:
            return 100.0 if self.executed_amount > 0 else 0.0
        return round((self.executed_amount / self.allocated_amount) * 100, 1)

    @computed_field
    @property
    def status_color(self) -> str:
        pct = self.execution_percentage
        if pct >= self.red_threshold:
            return "red"
        if pct >= self.yellow_threshold:
            return "yellow"
        return "green"

    model_config = {"from_attributes": True}
