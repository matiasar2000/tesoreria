from typing import Any

from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.schemas.ai import AiFinding, AiSource
from app.services.ai_tools.common import format_currency
from app.services.ai_tools.types import ReadOnlyToolContext


def get_bank_context(db: Session, context: ReadOnlyToolContext) -> dict[str, Any]:
    total_transactions = db.query(BankTransaction).count()
    reconciled = db.query(BankTransaction).filter(BankTransaction.reconciled.is_(True)).count()
    pending = total_transactions - reconciled
    accounts = db.query(BankAccount).filter(BankAccount.is_active.is_(True)).order_by(BankAccount.alias).all()
    account_payload = [
        {"id": str(account.id), "alias": account.alias, "bank_name": account.bank_name, "balance": float(account.balance)}
        for account in accounts
    ]
    total_balance = sum(account["balance"] for account in account_payload)

    for account in accounts[:5]:
        context.sources.append(
            AiSource(
                entity_type="bank_account",
                entity_id=account.id,
                label=account.alias,
                detail=f"Saldo {format_currency(float(account.balance))}",
            )
        )
    if pending:
        context.findings.append(
            AiFinding(
                code="unreconciled_bank_transactions",
                severity="warning",
                message=f"Hay {pending} movimientos bancarios sin conciliar.",
            )
        )

    context.add_tool_call("get_bank_transactions", {"reconciled": "summary"}, f"{pending} sin conciliar.")
    return {
        "total_transactions": total_transactions,
        "reconciled": reconciled,
        "pending": pending,
        "reconciliation_percentage": round((reconciled / total_transactions) * 100, 1) if total_transactions else 0,
        "total_balance": total_balance,
        "accounts": account_payload,
    }
