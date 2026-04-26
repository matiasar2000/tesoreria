import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.services import fiscal_close_service

router = APIRouter(prefix="/fiscal-close", tags=["Cierre Contable"])


@router.get("/{fiscal_year_id}/summary")
def close_summary(fiscal_year_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return fiscal_close_service.get_close_summary(db, fiscal_year_id)


@router.post("/{fiscal_year_id}/close")
def close_fiscal_year(fiscal_year_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return fiscal_close_service.close_fiscal_year(db, fiscal_year_id)


@router.post("/{fiscal_year_id}/reopen")
def reopen_fiscal_year(fiscal_year_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return fiscal_close_service.reopen_fiscal_year(db, fiscal_year_id)
