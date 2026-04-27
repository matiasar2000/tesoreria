import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class IncomeCreate(BaseModel):
    fiscal_year_id: uuid.UUID
    source_type: str
    amount: float
    income_date: date
    source_detail: str | None = None
    reference: str | None = None
    company_id: uuid.UUID | None = None
    notes: str | None = None


class IncomeResponse(BaseModel):
    id: uuid.UUID
    fiscal_year_id: uuid.UUID
    source_type: str
    source_detail: str | None
    amount: float
    income_date: date
    reference: str | None
    company_id: uuid.UUID | None
    notes: str | None
    created_by_id: uuid.UUID
    created_at: datetime
    source_type_label: str
    company_name: str | None = None
    created_by_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
