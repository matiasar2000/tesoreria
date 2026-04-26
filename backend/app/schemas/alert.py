import uuid
from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: uuid.UUID
    type: str
    severity: str
    title: str
    message: str
    target_user_id: uuid.UUID | None
    target_role: str | None
    related_entity_type: str | None
    related_entity_id: uuid.UUID | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
