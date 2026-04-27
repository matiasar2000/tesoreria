import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetResponse, AssetUpdate


VALID_CATEGORIES = {
    "vehiculo",
    "herramienta",
    "uniforme",
    "equipamiento",
    "inmueble",
    "mobiliario",
    "material_operativo",
    "otro",
}
VALID_CONDITIONS = {"bueno", "regular", "malo", "baja"}


def _validate_category(category: str | None) -> None:
    if category and category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Categoria invalida. Opciones: {', '.join(sorted(VALID_CATEGORIES))}")


def _validate_condition(condition: str | None) -> None:
    if condition and condition not in VALID_CONDITIONS:
        raise HTTPException(status_code=400, detail=f"Condicion invalida. Opciones: {', '.join(sorted(VALID_CONDITIONS))}")


def _validate_non_nullable_updates(update_data: dict) -> None:
    for field in ("name", "category", "current_condition", "is_active"):
        if field in update_data and update_data[field] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campo obligatorio no puede ser nulo.")


def _to_response(asset: Asset) -> AssetResponse:
    return AssetResponse(
        id=asset.id,
        name=asset.name,
        description=asset.description,
        category=asset.category,
        serial_number=asset.serial_number,
        company_id=asset.company_id,
        acquisition_date=asset.acquisition_date,
        acquisition_value=float(asset.acquisition_value) if asset.acquisition_value is not None else None,
        current_condition=asset.current_condition,
        location=asset.location,
        is_active=asset.is_active,
        notes=asset.notes,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        company_name=asset.company.name if asset.company else None,
    )


def create_asset(db: Session, data: AssetCreate) -> AssetResponse:
    _validate_category(data.category)
    _validate_condition(data.current_condition)
    asset = Asset(**data.model_dump(exclude_none=True))
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _to_response(asset)


def get_assets(
    db: Session,
    category: str | None = None,
    company_id: uuid.UUID | None = None,
    condition: str | None = None,
    is_active: bool | None = True,
) -> list[AssetResponse]:
    _validate_category(category)
    _validate_condition(condition)
    query = db.query(Asset)
    if category:
        query = query.filter(Asset.category == category)
    if company_id:
        query = query.filter(Asset.company_id == company_id)
    if condition:
        query = query.filter(Asset.current_condition == condition)
    if is_active is not None:
        query = query.filter(Asset.is_active.is_(is_active))
    assets = query.order_by(Asset.name).all()
    return [_to_response(asset) for asset in assets]


def get_asset(db: Session, asset_id: uuid.UUID) -> AssetResponse:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bien no encontrado.")
    return _to_response(asset)


def update_asset(db: Session, asset_id: uuid.UUID, data: AssetUpdate) -> AssetResponse:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bien no encontrado.")
    update_data = data.model_dump(exclude_unset=True)
    _validate_non_nullable_updates(update_data)
    _validate_category(update_data.get("category"))
    _validate_condition(update_data.get("current_condition"))
    for field, value in update_data.items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return _to_response(asset)


def get_summary(db: Session) -> dict:
    total_assets = db.query(func.count(Asset.id)).scalar() or 0
    active_count = db.query(func.count(Asset.id)).filter(Asset.is_active.is_(True)).scalar() or 0
    baja_count = db.query(func.count(Asset.id)).filter(Asset.current_condition == "baja").scalar() or 0
    total_value = db.query(func.coalesce(func.sum(Asset.acquisition_value), 0)).scalar() or 0
    category_rows = db.query(Asset.category, func.count(Asset.id)).group_by(Asset.category).all()

    return {
        "total_assets": int(total_assets),
        "total_value": float(total_value),
        "active_count": int(active_count),
        "baja_count": int(baja_count),
        "by_category": {category: int(count) for category, count in category_rows},
    }
