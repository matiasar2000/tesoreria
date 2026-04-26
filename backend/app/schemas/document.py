import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: uuid.UUID
    expense_id: uuid.UUID
    original_filename: str
    content_type: str
    file_size: int
    uploaded_by_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
