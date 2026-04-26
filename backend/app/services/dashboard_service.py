from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.budget_item import BudgetItem
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.schemas.alert import AlertResponse
from app.schemas.budget_item import BudgetItemResponse
from app.schemas.dashboard import BankBalanceSummary, DashboardSummary


def get_dashboard(db: Session, year: int | None = None) -> DashboardSummary:
    if year is None:
        year = date.today().year

    fy = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    if not fy:
        return _empty_dashboard(year)

    items = db.query(BudgetItem).filter(BudgetItem.fiscal_year_id == fy.id).order_by(BudgetItem.number).all()
    item_responses = [BudgetItemResponse.model_validate(i) for i in items]

    total_executed = sum(float(i.executed_amount) for i in items)
    total_budget = float(fy.total_budget)
    total_available = total_budget - total_executed

    today = date.today()
    first_of_month = date(today.year, today.month, 1)
    month_expenses = (
        db.query(func.coalesce(func.sum(Expense.amount), 0), func.count(Expense.id))
        .filter(Expense.fiscal_year_id == fy.id, Expense.expense_date >= first_of_month, Expense.status == "approved")
        .first()
    )

    pending_approvals = db.query(Expense).filter(Expense.fiscal_year_id == fy.id, Expense.status == "pending_approval").count()

    recent_alerts = (
        db.query(Alert)
        .filter(Alert.read == False)  # noqa: E712
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )

    colors = {"green": 0, "yellow": 0, "red": 0}
    for ir in item_responses:
        colors[ir.status_color] += 1

    return DashboardSummary(
        fiscal_year=year,
        fiscal_year_status=fy.status,
        total_budget=total_budget,
        total_executed=total_executed,
        total_available=total_available,
        execution_percentage=round((total_executed / total_budget) * 100, 1) if total_budget else 0,
        total_bank_balance=0,
        bank_accounts=[],
        expenses_this_month=float(month_expenses[0]),
        expenses_count_this_month=month_expenses[1],
        pending_approvals=pending_approvals,
        budget_items=item_responses,
        recent_alerts=[AlertResponse.model_validate(a) for a in recent_alerts],
        items_in_red=colors["red"],
        items_in_yellow=colors["yellow"],
        items_in_green=colors["green"],
    )


def _empty_dashboard(year: int) -> DashboardSummary:
    return DashboardSummary(
        fiscal_year=year,
        fiscal_year_status="none",
        total_budget=0,
        total_executed=0,
        total_available=0,
        execution_percentage=0,
        total_bank_balance=0,
        bank_accounts=[],
        expenses_this_month=0,
        expenses_count_this_month=0,
        pending_approvals=0,
        budget_items=[],
        recent_alerts=[],
        items_in_red=0,
        items_in_yellow=0,
        items_in_green=0,
    )
