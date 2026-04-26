from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyResponse

router = APIRouter(prefix="/companies", tags=["Compañías"])


@router.get("", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Company).order_by(Company.number).all()
