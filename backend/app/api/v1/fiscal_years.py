import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.fiscal_year import FiscalYear
from app.models.user import User
from app.schemas.fiscal_year import FiscalYearCreate, FiscalYearResponse, FiscalYearUpdate
from app.services.budget_service import get_fiscal_year

router = APIRouter(prefix="/fiscal-years", tags=["Años Fiscales"])


@router.get("", response_model=list[FiscalYearResponse])
def list_fiscal_years(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(FiscalYear).order_by(FiscalYear.year.desc()).all()


@router.post("", response_model=FiscalYearResponse, status_code=201)
def create_fiscal_year(data: FiscalYearCreate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    fy = FiscalYear(**data.model_dump())
    db.add(fy)
    db.commit()
    db.refresh(fy)
    return fy


@router.get("/{fiscal_year_id}", response_model=FiscalYearResponse)
def get_fiscal_year_detail(fiscal_year_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_fiscal_year(db, fiscal_year_id)


@router.put("/{fiscal_year_id}", response_model=FiscalYearResponse)
def update_fiscal_year(fiscal_year_id: uuid.UUID, data: FiscalYearUpdate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    fy = get_fiscal_year(db, fiscal_year_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fy, field, value)
    db.commit()
    db.refresh(fy)
    return fy
