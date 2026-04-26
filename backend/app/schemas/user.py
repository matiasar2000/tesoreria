import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    company_id: uuid.UUID | None = None
    area: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    company_id: uuid.UUID | None = None
    area: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    company_id: uuid.UUID | None
    area: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
