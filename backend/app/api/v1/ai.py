import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.ai import AiQueryRequest, AiQueryResponse, AiRunListItem, AiRunResponse
from app.schemas.common import PaginatedResponse
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["IA"])


@router.post("/query", response_model=AiQueryResponse)
def query_ai(
    data: AiQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiQueryResponse:
    return ai_service.run_read_only_query(db, data, current_user)


@router.get("/runs", response_model=PaginatedResponse[AiRunListItem])
def list_ai_runs(
    intent: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[AiRunListItem]:
    return ai_service.list_ai_runs(
        db,
        current_user,
        intent=intent,
        run_status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/runs/{run_id}", response_model=AiRunResponse)
def get_ai_run(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiRunResponse:
    return ai_service.get_ai_run(db, run_id, current_user)
