import uuid
from datetime import date, datetime

from pydantic import BaseModel


class RenditionCreate(BaseModel):
    fiscal_year_id: uuid.UUID
    company_id: uuid.UUID
    period_start: date
    period_end: date
    notes: str | None = None


class RenditionItemResponse(BaseModel):
    id: uuid.UUID
    expense_id: uuid.UUID
    expense_description: str | None = None
    expense_amount: float | None = None
    expense_date: date | None = None
    expense_supplier: str | None = None

    model_config = {"from_attributes": True}


class RenditionResponse(BaseModel):
    id: uuid.UUID
    fiscal_year_id: uuid.UUID
    company_id: uuid.UUID
    company_name: str | None = None
    period_start: date
    period_end: date
    total_amount: float
    status: str
    notes: str | None
    submitted_by_name: str | None = None
    approved_by_name: str | None = None
    submitted_at: datetime | None
    approved_at: datetime | None
    created_at: datetime
    items: list[RenditionItemResponse] = []

    model_config = {"from_attributes": True}
