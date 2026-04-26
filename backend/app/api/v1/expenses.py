import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero, require_tesorero_or_equipo
from app.database import get_db
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services import expense_service

router = APIRouter(prefix="/expenses", tags=["Gastos"])


class RejectBody(BaseModel):
    reason: str | None = None


class ApprovalBody(BaseModel):
    notes: str | None = None


@router.get("", response_model=PaginatedResponse[ExpenseResponse])
def list_expenses(
    fiscal_year_id: uuid.UUID | None = None,
    budget_item_id: uuid.UUID | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = expense_service.get_expenses(db, fiscal_year_id, budget_item_id, status, page, page_size)
    pages = (total + page_size - 1) // page_size
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tesorero_or_equipo),
):
    return expense_service.create_expense(db, data, current_user)


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return expense_service.get_expense(db, expense_id)


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_tesorero_or_equipo),
):
    return expense_service.update_expense(db, expense_id, data)


@router.patch("/{expense_id}/advance", response_model=ExpenseResponse)
def advance_approval(
    expense_id: uuid.UUID,
    body: ApprovalBody | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return expense_service.advance_approval(db, expense_id, current_user, body.notes if body else None)


@router.patch("/{expense_id}/approve", response_model=ExpenseResponse)
def approve_expense(
    expense_id: uuid.UUID,
    body: ApprovalBody | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return expense_service.advance_approval(db, expense_id, current_user, body.notes if body else None)


@router.patch("/{expense_id}/reject", response_model=ExpenseResponse)
def reject_expense(
    expense_id: uuid.UUID,
    body: RejectBody | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return expense_service.reject_expense(db, expense_id, current_user, body.reason if body else None)


@router.patch("/{expense_id}/void", response_model=ExpenseResponse)
def void_expense(
    expense_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_tesorero),
):
    return expense_service.void_expense(db, expense_id)


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    expense_service.delete_expense(db, expense_id)
