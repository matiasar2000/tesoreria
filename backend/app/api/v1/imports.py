import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.services import import_service

router = APIRouter(prefix="/import", tags=["Importación"])


@router.post("/budget/{fiscal_year_id}")
def import_budget(
    fiscal_year_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_tesorero),
):
    return import_service.import_budget_from_excel(db, file, fiscal_year_id)


@router.post("/expenses/{fiscal_year_id}")
def import_expenses(
    fiscal_year_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tesorero),
):
    return import_service.import_expenses_from_excel(db, file, fiscal_year_id, current_user.id)
