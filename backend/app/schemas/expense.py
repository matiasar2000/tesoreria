import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ExpenseInventoryAssetCreate(BaseModel):
    name: str
    category: str
    description: str | None = None
    serial_number: str | None = None
    current_condition: str = "bueno"
    location: str | None = None
    notes: str | None = None


class ExpenseCreate(BaseModel):
    budget_item_id: uuid.UUID
    amount: float
    description: str
    supplier_rut: str | None = None
    supplier_name: str | None = None
    invoice_number: str | None = None
    expense_date: date
    company_id: uuid.UUID | None = None
    authorized_by_superintendent: bool = False
    notes: str | None = None
    create_inventory_asset: bool = False
    inventory_asset: ExpenseInventoryAssetCreate | None = None


class ExpenseUpdate(BaseModel):
    amount: float | None = None
    description: str | None = None
    supplier_rut: str | None = None
    supplier_name: str | None = None
    invoice_number: str | None = None
    expense_date: date | None = None
    company_id: uuid.UUID | None = None
    notes: str | None = None


class ApprovalStepBrief(BaseModel):
    id: uuid.UUID
    step_order: int
    role_required: str
    label: str
    status: str
    acted_by_name: str | None = None
    acted_at: datetime | None = None


class ExpenseInventoryAssetBrief(BaseModel):
    id: uuid.UUID
    name: str
    category: str
    serial_number: str | None = None
    current_condition: str
    is_active: bool


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    budget_item_id: uuid.UUID
    fiscal_year_id: uuid.UUID
    company_id: uuid.UUID | None
    amount: float
    description: str
    supplier_rut: str | None
    supplier_name: str | None
    invoice_number: str | None
    expense_date: date
    status: str
    requires_quotations: bool
    has_reception_act: bool
    authorized_by_superintendent: bool
    requested_by_id: uuid.UUID
    approved_by_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    budget_item_name: str | None = None
    requested_by_name: str | None = None
    approval_steps: list[ApprovalStepBrief] = []
    inventory_assets: list[ExpenseInventoryAssetBrief] = []

    model_config = {"from_attributes": True}
