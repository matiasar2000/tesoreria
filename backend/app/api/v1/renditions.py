import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.schemas.rendition import RenditionCreate, RenditionResponse
from app.services import rendition_service

router = APIRouter(prefix="/renditions", tags=["Rendiciones"])


class RejectBody(BaseModel):
    reason: str | None = None


@router.get("", response_model=list[RenditionResponse])
def list_renditions(
    fiscal_year_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return rendition_service.get_renditions(db, fiscal_year_id, company_id, status)


@router.post("", response_model=RenditionResponse, status_code=201)
def create_rendition(data: RenditionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_tesorero)):
    return rendition_service.create_rendition(db, data, current_user)


@router.get("/{rendition_id}", response_model=RenditionResponse)
def get_rendition(rendition_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return rendition_service.get_rendition(db, rendition_id)


@router.patch("/{rendition_id}/submit", response_model=RenditionResponse)
def submit_rendition(rendition_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_tesorero)):
    return rendition_service.submit_rendition(db, rendition_id, current_user)


@router.patch("/{rendition_id}/approve", response_model=RenditionResponse)
def approve_rendition(rendition_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_tesorero)):
    return rendition_service.approve_rendition(db, rendition_id, current_user)


@router.patch("/{rendition_id}/reject", response_model=RenditionResponse)
def reject_rendition(
    rendition_id: uuid.UUID,
    body: RejectBody | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_tesorero),
):
    return rendition_service.reject_rendition(db, rendition_id, body.reason if body else None)
