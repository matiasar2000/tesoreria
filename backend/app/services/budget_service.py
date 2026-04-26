import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.budget_item import BudgetItem
from app.models.fiscal_year import FiscalYear
from app.schemas.budget_item import BudgetItemUpdate


def get_fiscal_year(db: Session, fiscal_year_id: uuid.UUID) -> FiscalYear:
    fy = db.query(FiscalYear).filter(FiscalYear.id == fiscal_year_id).first()
    if not fy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Año fiscal no encontrado.")
    return fy


def get_fiscal_year_by_year(db: Session, year: int) -> FiscalYear | None:
    return db.query(FiscalYear).filter(FiscalYear.year == year).first()


def get_budget_items(db: Session, fiscal_year_id: uuid.UUID) -> list[BudgetItem]:
    get_fiscal_year(db, fiscal_year_id)
    return (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fiscal_year_id)
        .order_by(BudgetItem.number)
        .all()
    )


def get_budget_item(db: Session, item_id: uuid.UUID) -> BudgetItem:
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partida no encontrada.")
    return item


def update_budget_item(db: Session, item_id: uuid.UUID, data: BudgetItemUpdate) -> BudgetItem:
    item = get_budget_item(db, item_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def toggle_block(db: Session, item_id: uuid.UUID) -> BudgetItem:
    item = get_budget_item(db, item_id)
    item.is_blocked = not item.is_blocked
    db.commit()
    db.refresh(item)
    return item


def check_auto_block(db: Session, item: BudgetItem) -> None:
    """Bloquea automáticamente si la ejecución alcanza el 100%."""
    if item.allocated_amount > 0:
        pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100
        if pct >= float(item.red_threshold) and not item.is_blocked:
            item.is_blocked = True
            db.flush()
