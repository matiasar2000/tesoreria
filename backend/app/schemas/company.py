import uuid

from pydantic import BaseModel


class CompanyResponse(BaseModel):
    id: uuid.UUID
    number: int
    name: str
    is_active: bool

    model_config = {"from_attributes": True}
