import uuid
from datetime import datetime

from pydantic import BaseModel


class FiscalYearCreate(BaseModel):
    year: int
    total_budget: float
    imm_value: float = 500000
    notes: str | None = None


class FiscalYearUpdate(BaseModel):
    total_budget: float | None = None
    status: str | None = None
    imm_value: float | None = None
    notes: str | None = None


class FiscalYearResponse(BaseModel):
    id: uuid.UUID
    year: int
    total_budget: float
    status: str
    approved_at: datetime | None
    approved_by: str | None
    imm_value: float
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
