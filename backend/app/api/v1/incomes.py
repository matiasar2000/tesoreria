import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.schemas.income import IncomeCreate, IncomeResponse
from app.services import income_service

router = APIRouter(prefix="/incomes", tags=["Ingresos"])


@router.get("", response_model=list[IncomeResponse])
def list_incomes(
    fiscal_year_id: uuid.UUID | None = None,
    source_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return income_service.get_incomes(db, fiscal_year_id, source_type)


@router.post("", response_model=IncomeResponse, status_code=201)
def create_income(
    data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tesorero),
):
    return income_service.create_income(db, data, current_user.id)


@router.get("/summary")
def get_income_summary(
    fiscal_year_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return income_service.get_income_summary(db, fiscal_year_id)


@router.delete("/{income_id}", status_code=204)
def delete_income(income_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    income_service.delete_income(db, income_id)
