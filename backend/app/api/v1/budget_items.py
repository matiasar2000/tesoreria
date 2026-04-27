import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.schemas.budget_item import BudgetItemResponse, BudgetItemUpdate
from app.services import budget_service

router = APIRouter(prefix="/fiscal-years/{fiscal_year_id}/budget-items", tags=["Partidas Presupuestarias"])
direct_router = APIRouter(prefix="/budget-items", tags=["Partidas Presupuestarias"])


@direct_router.get("/{item_id}", response_model=BudgetItemResponse)
def get_budget_item_direct(item_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return budget_service.get_budget_item(db, item_id)


@router.get("", response_model=list[BudgetItemResponse])
def list_budget_items(fiscal_year_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return budget_service.get_budget_items(db, fiscal_year_id)


@router.get("/{item_id}", response_model=BudgetItemResponse)
def get_budget_item(item_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user), fiscal_year_id: uuid.UUID = None):
    return budget_service.get_budget_item(db, item_id)


@router.put("/{item_id}", response_model=BudgetItemResponse)
def update_budget_item(
    item_id: uuid.UUID, data: BudgetItemUpdate, db: Session = Depends(get_db), _: User = Depends(require_tesorero), fiscal_year_id: uuid.UUID = None
):
    return budget_service.update_budget_item(db, item_id, data)


@router.patch("/{item_id}/block", response_model=BudgetItemResponse)
def toggle_block(item_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero), fiscal_year_id: uuid.UUID = None):
    return budget_service.toggle_block(db, item_id)
