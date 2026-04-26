import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.expense import Expense
from app.models.user import User
from app.schemas.document import DocumentResponse

UPLOAD_ROOT = "/app/uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"}


def _sanitize_filename(filename: str | None) -> str:
    safe_name = os.path.basename((filename or "documento").replace("\\", "/")).strip()
    return safe_name or "documento"


def _validate_file(original_filename: str, contents: bytes) -> None:
    extension = Path(original_filename).suffix.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de archivo no permitido.",
        )
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no puede superar 10MB.",
        )


def _to_response(document: Document) -> DocumentResponse:
    return DocumentResponse.model_validate(document)


def upload_document(db: Session, expense_id: uuid.UUID, file: UploadFile, current_user: User) -> DocumentResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gasto no encontrado.")

    original_filename = _sanitize_filename(file.filename)
    contents = file.file.read()
    _validate_file(original_filename, contents)

    upload_dir = os.path.join(UPLOAD_ROOT, str(expense_id))
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}_{original_filename}"
    storage_path = os.path.join(upload_dir, filename)
    with open(storage_path, "wb") as destination:
        destination.write(contents)

    document = Document(
        expense_id=expense_id,
        filename=filename,
        original_filename=original_filename,
        content_type=file.content_type or "application/octet-stream",
        file_size=len(contents),
        storage_path=storage_path,
        uploaded_by_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return _to_response(document)


def get_documents(db: Session, expense_id: uuid.UUID) -> list[DocumentResponse]:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gasto no encontrado.")

    documents = db.query(Document).filter(Document.expense_id == expense_id).order_by(Document.created_at.desc()).all()
    return [_to_response(document) for document in documents]


def get_document_file(db: Session, document_id: uuid.UUID) -> FileResponse:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")
    if not os.path.exists(document.storage_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")

    return FileResponse(
        document.storage_path,
        media_type=document.content_type,
        filename=document.original_filename,
    )


def delete_document(db: Session, document_id: uuid.UUID) -> None:
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")

    if os.path.exists(document.storage_path):
        os.remove(document.storage_path)

    db.delete(document)
    db.commit()
