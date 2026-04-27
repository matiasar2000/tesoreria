import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AiQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    year: int | None = Field(default=None, ge=2000, le=2100)
    thread_id: uuid.UUID | None = None


class AiSource(BaseModel):
    entity_type: str
    label: str
    entity_id: uuid.UUID | None = None
    detail: str | None = None


class AiFinding(BaseModel):
    code: str
    severity: str
    message: str
    source: AiSource | None = None


class AiToolCall(BaseModel):
    name: str
    args: dict
    result_summary: str


class AiProposedAction(BaseModel):
    action_type: str
    label: str
    requires_human_review: bool = True


class AiQueryResponse(BaseModel):
    run_id: uuid.UUID
    thread_id: uuid.UUID
    status: str
    intent: str
    answer: str
    confidence: float | None
    sources: list[AiSource]
    findings: list[AiFinding]
    proposed_actions: list[AiProposedAction]
    tool_calls: list[AiToolCall]


class AiRunResponse(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    intent: str
    input_payload: dict
    user_context: dict
    domain_context: dict
    policy_context: dict
    tool_calls: list
    findings: list
    confidence: float | None
    proposed_actions: list
    human_review: dict | None
    final_response: str | None
    audit_trace: list
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class AiRunListItem(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    intent: str
    question: str | None = None
    confidence: float | None
    final_response: str | None
    created_at: datetime
    completed_at: datetime | None
