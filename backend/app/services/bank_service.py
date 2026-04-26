import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.expense import Expense
from app.schemas.bank import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    BankTransactionCreate,
    BankTransactionResponse,
    ReconcileRequest,
)


def _tx_response(tx: BankTransaction) -> BankTransactionResponse:
    data = {c.name: getattr(tx, c.name) for c in tx.__table__.columns}
    data["bank_account_alias"] = tx.bank_account.alias if tx.bank_account else None
    data["reconciled_expense_desc"] = tx.reconciled_expense.description if tx.reconciled_expense else None
    return BankTransactionResponse(**data)


def create_account(db: Session, data: BankAccountCreate) -> BankAccountResponse:
    account = BankAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return BankAccountResponse.model_validate(account)


def get_accounts(db: Session) -> list[BankAccountResponse]:
    accounts = db.query(BankAccount).order_by(BankAccount.alias).all()
    return [BankAccountResponse.model_validate(a) for a in accounts]


def get_account(db: Session, account_id: uuid.UUID) -> BankAccountResponse:
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta bancaria no encontrada.")
    return BankAccountResponse.model_validate(account)


def update_account(db: Session, account_id: uuid.UUID, data: BankAccountUpdate) -> BankAccountResponse:
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta bancaria no encontrada.")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return BankAccountResponse.model_validate(account)


def create_transaction(db: Session, data: BankTransactionCreate) -> BankTransactionResponse:
    account = db.query(BankAccount).filter(BankAccount.id == data.bank_account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta bancaria no encontrada.")

    tx = BankTransaction(**data.model_dump())
    db.add(tx)

    if data.transaction_type == "credit":
        account.balance = float(account.balance) + data.amount
    else:
        account.balance = float(account.balance) - data.amount

    db.commit()
    db.refresh(tx)
    return _tx_response(tx)


def get_transactions(
    db: Session,
    bank_account_id: uuid.UUID | None = None,
    reconciled: bool | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[BankTransactionResponse], int]:
    query = db.query(BankTransaction)
    if bank_account_id:
        query = query.filter(BankTransaction.bank_account_id == bank_account_id)
    if reconciled is not None:
        query = query.filter(BankTransaction.reconciled == reconciled)

    total = query.count()
    txs = query.order_by(BankTransaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [_tx_response(t) for t in txs], total


def reconcile(db: Session, data: ReconcileRequest) -> BankTransactionResponse:
    tx = db.query(BankTransaction).filter(BankTransaction.id == data.transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Movimiento bancario no encontrado.")
    if tx.reconciled:
        raise HTTPException(status_code=400, detail="Este movimiento ya esta conciliado.")

    expense = db.query(Expense).filter(Expense.id == data.expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    if expense.status != "approved":
        raise HTTPException(status_code=400, detail="Solo se pueden conciliar gastos aprobados.")

    tx.reconciled = True
    tx.reconciled_expense_id = expense.id
    db.commit()
    db.refresh(tx)
    return _tx_response(tx)


def unreconcile(db: Session, transaction_id: uuid.UUID) -> BankTransactionResponse:
    tx = db.query(BankTransaction).filter(BankTransaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Movimiento bancario no encontrado.")
    if not tx.reconciled:
        raise HTTPException(status_code=400, detail="Este movimiento no esta conciliado.")

    tx.reconciled = False
    tx.reconciled_expense_id = None
    db.commit()
    db.refresh(tx)
    return _tx_response(tx)


def get_reconciliation_summary(db: Session, bank_account_id: uuid.UUID | None = None) -> dict:
    query = db.query(BankTransaction)
    if bank_account_id:
        query = query.filter(BankTransaction.bank_account_id == bank_account_id)

    total = query.count()
    reconciled_count = query.filter(BankTransaction.reconciled == True).count()  # noqa: E712
    pending_count = total - reconciled_count

    return {
        "total_transactions": total,
        "reconciled": reconciled_count,
        "pending": pending_count,
        "reconciliation_percentage": round((reconciled_count / total) * 100, 1) if total > 0 else 0,
    }
