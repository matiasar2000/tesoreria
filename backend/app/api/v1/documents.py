import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero_or_equipo
from app.database import get_db
from app.models.user import User
from app.schemas.document import DocumentResponse
from app.services import document_service

router = APIRouter(tags=["Documentos"])


@router.post("/expenses/{expense_id}/documents", response_model=DocumentResponse, status_code=201)
def upload_document(
    expense_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tesorero_or_equipo),
):
    return document_service.upload_document(db, expense_id, file, current_user)


@router.get("/expenses/{expense_id}/documents", response_model=list[DocumentResponse])
def list_documents(
    expense_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return document_service.get_documents(db, expense_id)


@router.get("/documents/{document_id}/download", response_class=FileResponse)
def download_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return document_service.get_document_file(db, document_id)


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_tesorero_or_equipo),
):
    document_service.delete_document(db, document_id)
