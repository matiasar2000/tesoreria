import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.schemas.asset import AssetCreate, AssetResponse, AssetUpdate
from app.services import asset_service

router = APIRouter(prefix="/assets", tags=["Inventario de Bienes"])


@router.get("", response_model=list[AssetResponse])
def list_assets(
    category: str | None = None,
    company_id: uuid.UUID | None = None,
    condition: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return asset_service.get_assets(db, category=category, company_id=company_id, condition=condition)


@router.get("/summary")
def get_asset_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return asset_service.get_summary(db)


@router.post("", response_model=AssetResponse, status_code=201)
def create_asset(data: AssetCreate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return asset_service.create_asset(db, data)


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(asset_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return asset_service.get_asset(db, asset_id)


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: uuid.UUID, data: AssetUpdate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return asset_service.update_asset(db, asset_id, data)
