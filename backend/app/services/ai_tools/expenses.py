from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.user import User
from app.schemas.ai import AiFinding, AiSource
from app.services.ai_tools.common import format_currency, get_fiscal_year
from app.services.ai_tools.types import ReadOnlyToolContext

PENDING_EXPENSE_STATUSES = ["pending_review", "pending_approval", "pending_directorio"]


def get_pending_expenses_context(
    db: Session,
    year: int,
    user: User,
    context: ReadOnlyToolContext,
) -> dict[str, Any]:
    fiscal_year = get_fiscal_year(db, year, context)
    if not fiscal_year:
        context.add_tool_call("search_expenses", {"year": year, "status": "pending"}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    query = db.query(Expense).filter(
        Expense.fiscal_year_id == fiscal_year.id,
        Expense.status.in_(PENDING_EXPENSE_STATUSES),
    )
    if user.role == "director_compania" and user.company_id:
        query = query.filter(Expense.company_id == user.company_id)

    total_amount = float(query.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0)
    total_count = query.count()
    expenses = query.order_by(Expense.expense_date.desc()).limit(10).all()
    items = [expense_payload(expense) for expense in expenses]
    for expense in expenses[:5]:
        context.sources.append(
            AiSource(
                entity_type="expense",
                entity_id=expense.id,
                label=expense.description,
                detail=f"Estado {expense.status}, monto {format_currency(float(expense.amount))}",
            )
        )
    if total_count:
        context.findings.append(
            AiFinding(
                code="pending_expenses_found",
                severity="warning",
                message=f"Hay {total_count} gastos pendientes por {format_currency(total_amount)}.",
            )
        )

    context.add_tool_call("search_expenses", {"year": year, "status": "pending"}, f"{total_count} pendientes.")
    return {"year": year, "count": total_count, "total_amount": total_amount, "items": items}


def get_large_expenses_context(
    db: Session,
    year: int,
    user: User,
    context: ReadOnlyToolContext,
) -> dict[str, Any]:
    fiscal_year = get_fiscal_year(db, year, context)
    if not fiscal_year:
        context.add_tool_call("search_expenses", {"year": year, "threshold": "5 IMM"}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    limit = float(fiscal_year.imm_value) * 5
    query = db.query(Expense).filter(Expense.fiscal_year_id == fiscal_year.id, Expense.amount > limit)
    if user.role == "director_compania" and user.company_id:
        query = query.filter(Expense.company_id == user.company_id)
    expenses = query.order_by(Expense.amount.desc()).limit(10).all()
    items = [expense_payload(expense) for expense in expenses]

    for expense in expenses[:5]:
        context.sources.append(
            AiSource(
                entity_type="expense",
                entity_id=expense.id,
                label=expense.description,
                detail=f"Sobre 5 IMM ({format_currency(limit)}).",
            )
        )
    if expenses:
        context.findings.append(
            AiFinding(
                code="expenses_over_imm",
                severity="warning",
                message=f"Hay {len(expenses)} gastos sobre 5 IMM en la muestra consultada.",
            )
        )

    context.add_tool_call(
        "search_expenses",
        {"year": year, "amount_gt": limit},
        f"{len(expenses)} gastos encontrados sobre 5 IMM.",
    )
    return {"year": year, "imm_value": float(fiscal_year.imm_value), "limit_5_imm": limit, "items": items}


def expense_payload(expense: Expense) -> dict[str, Any]:
    return {
        "id": str(expense.id),
        "description": expense.description,
        "amount": float(expense.amount),
        "status": expense.status,
        "expense_date": expense.expense_date.isoformat(),
        "supplier_name": expense.supplier_name,
        "budget_item_id": str(expense.budget_item_id),
        "company_id": str(expense.company_id) if expense.company_id else None,
    }
