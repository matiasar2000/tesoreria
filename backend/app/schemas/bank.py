import uuid
from datetime import date, datetime

from pydantic import BaseModel


class BankAccountCreate(BaseModel):
    bank_name: str
    account_number: str
    account_type: str
    alias: str
    balance: float = 0


class BankAccountUpdate(BaseModel):
    bank_name: str | None = None
    account_number: str | None = None
    account_type: str | None = None
    alias: str | None = None
    balance: float | None = None
    is_active: bool | None = None


class BankAccountResponse(BaseModel):
    id: uuid.UUID
    bank_name: str
    account_number: str
    account_type: str
    alias: str
    balance: float
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BankTransactionCreate(BaseModel):
    bank_account_id: uuid.UUID
    transaction_date: date
    amount: float
    transaction_type: str
    reference: str | None = None
    description: str | None = None


class BankTransactionResponse(BaseModel):
    id: uuid.UUID
    bank_account_id: uuid.UUID
    bank_account_alias: str | None = None
    transaction_date: date
    amount: float
    transaction_type: str
    reference: str | None
    description: str | None
    reconciled: bool
    reconciled_expense_id: uuid.UUID | None
    reconciled_expense_desc: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReconcileRequest(BaseModel):
    transaction_id: uuid.UUID
    expense_id: uuid.UUID


class ImportStatementResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
    total_credit: float
    total_debit: float
