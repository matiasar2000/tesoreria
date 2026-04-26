import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_tesorero
from app.database import get_db
from app.models.user import User
from app.schemas.bank import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    BankTransactionCreate,
    BankTransactionResponse,
    ReconcileRequest,
)
from app.schemas.common import PaginatedResponse
from app.services import bank_service

router = APIRouter(prefix="/bank", tags=["Banco"])


@router.get("/accounts", response_model=list[BankAccountResponse])
def list_accounts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return bank_service.get_accounts(db)


@router.post("/accounts", response_model=BankAccountResponse, status_code=201)
def create_account(data: BankAccountCreate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return bank_service.create_account(db, data)


@router.get("/accounts/{account_id}", response_model=BankAccountResponse)
def get_account(account_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return bank_service.get_account(db, account_id)


@router.put("/accounts/{account_id}", response_model=BankAccountResponse)
def update_account(account_id: uuid.UUID, data: BankAccountUpdate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return bank_service.update_account(db, account_id, data)


@router.get("/transactions", response_model=PaginatedResponse[BankTransactionResponse])
def list_transactions(
    bank_account_id: uuid.UUID | None = None,
    reconciled: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = bank_service.get_transactions(db, bank_account_id, reconciled, page, page_size)
    pages = (total + page_size - 1) // page_size
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/transactions", response_model=BankTransactionResponse, status_code=201)
def create_transaction(data: BankTransactionCreate, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return bank_service.create_transaction(db, data)


@router.post("/reconcile", response_model=BankTransactionResponse)
def reconcile(data: ReconcileRequest, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return bank_service.reconcile(db, data)


@router.patch("/transactions/{transaction_id}/unreconcile", response_model=BankTransactionResponse)
def unreconcile(transaction_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_tesorero)):
    return bank_service.unreconcile(db, transaction_id)


@router.get("/reconciliation-summary")
def reconciliation_summary(bank_account_id: uuid.UUID | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return bank_service.get_reconciliation_summary(db, bank_account_id)
