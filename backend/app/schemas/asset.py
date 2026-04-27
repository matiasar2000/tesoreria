import uuid
from datetime import date, datetime

from pydantic import BaseModel


class AssetCreate(BaseModel):
    name: str
    category: str
    description: str | None = None
    serial_number: str | None = None
    company_id: uuid.UUID | None = None
    acquisition_date: date | None = None
    acquisition_value: float | None = None
    current_condition: str | None = None
    location: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    serial_number: str | None = None
    company_id: uuid.UUID | None = None
    acquisition_date: date | None = None
    acquisition_value: float | None = None
    current_condition: str | None = None
    location: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class AssetResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    category: str
    serial_number: str | None
    company_id: uuid.UUID | None
    acquisition_date: date | None
    acquisition_value: float | None
    current_condition: str
    location: str | None
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
    company_name: str | None = None

    model_config = {"from_attributes": True}
