import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.budget_item import BudgetItem
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.models.rendition import Rendition
from app.schemas.budget_item import BudgetItemResponse


def get_close_summary(db: Session, fiscal_year_id: uuid.UUID) -> dict:
    fy = db.query(FiscalYear).filter(FiscalYear.id == fiscal_year_id).first()
    if not fy:
        raise HTTPException(status_code=404, detail="Año fiscal no encontrado.")

    items = db.query(BudgetItem).filter(BudgetItem.fiscal_year_id == fy.id).order_by(BudgetItem.number).all()
    item_responses = [BudgetItemResponse.model_validate(i) for i in items]

    total_allocated = sum(float(i.allocated_amount) for i in items)
    total_executed = sum(float(i.executed_amount) for i in items)
    total_available = total_allocated - total_executed

    pending_expenses = (
        db.query(Expense)
        .filter(
            Expense.fiscal_year_id == fy.id,
            Expense.status.in_(["pending_review", "pending_approval", "pending_directorio"]),
        )
        .count()
    )

    pending_renditions = (
        db.query(Rendition)
        .filter(Rendition.fiscal_year_id == fy.id, Rendition.status.in_(["draft", "submitted"]))
        .count()
    )

    can_close = pending_expenses == 0 and fy.status != "closed"

    return {
        "fiscal_year_id": str(fy.id),
        "year": fy.year,
        "status": fy.status,
        "total_allocated": total_allocated,
        "total_executed": total_executed,
        "total_available": total_available,
        "execution_percentage": round((total_executed / total_allocated) * 100, 1) if total_allocated else 0,
        "pending_expenses": pending_expenses,
        "pending_renditions": pending_renditions,
        "can_close": can_close,
        "budget_items": [i.model_dump() for i in item_responses],
    }


def close_fiscal_year(db: Session, fiscal_year_id: uuid.UUID) -> dict:
    fy = db.query(FiscalYear).filter(FiscalYear.id == fiscal_year_id).first()
    if not fy:
        raise HTTPException(status_code=404, detail="Año fiscal no encontrado.")
    if fy.status == "closed":
        raise HTTPException(status_code=400, detail="El año fiscal ya esta cerrado.")

    pending = (
        db.query(Expense)
        .filter(
            Expense.fiscal_year_id == fy.id,
            Expense.status.in_(["pending_review", "pending_approval", "pending_directorio"]),
        )
        .count()
    )
    if pending > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cerrar: hay {pending} gastos pendientes de aprobacion.",
        )

    items = db.query(BudgetItem).filter(BudgetItem.fiscal_year_id == fy.id).all()
    for item in items:
        item.is_blocked = True

    fy.status = "closed"
    fy.approved_at = datetime.now(timezone.utc)

    db.commit()
    return get_close_summary(db, fiscal_year_id)


def reopen_fiscal_year(db: Session, fiscal_year_id: uuid.UUID) -> dict:
    fy = db.query(FiscalYear).filter(FiscalYear.id == fiscal_year_id).first()
    if not fy:
        raise HTTPException(status_code=404, detail="Año fiscal no encontrado.")
    if fy.status != "closed":
        raise HTTPException(status_code=400, detail="Solo se pueden reabrir años fiscales cerrados.")

    items = db.query(BudgetItem).filter(BudgetItem.fiscal_year_id == fy.id).all()
    for item in items:
        pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100 if item.allocated_amount else 0
        item.is_blocked = pct >= float(item.red_threshold)

    fy.status = "active"
    fy.approved_at = None
    db.commit()
    return get_close_summary(db, fiscal_year_id)
