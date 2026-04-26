import uuid
from datetime import datetime

from pydantic import BaseModel


class ApprovalStepResponse(BaseModel):
    id: uuid.UUID
    expense_id: uuid.UUID
    step_order: int
    role_required: str
    label: str
    status: str
    acted_by_id: uuid.UUID | None
    acted_by_name: str | None = None
    acted_at: datetime | None
    notes: str | None

    model_config = {"from_attributes": True}
