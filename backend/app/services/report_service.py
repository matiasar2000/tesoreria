from calendar import monthrange
from datetime import date

from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.budget_item import BudgetItem
from app.models.company import Company
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.schemas.reports import (
    AnnualBalance,
    BankBalance,
    BudgetExecution,
    CompanyExpense,
    MonthlyExpense,
    QuarterlyBalance,
    ReportsSummary,
    StatusBreakdown,
    TopSupplier,
)

MONTH_NAMES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

STATUS_LABELS = {
    "draft": "Borrador",
    "pending_review": "Revisión",
    "pending_approval": "Aprobación",
    "pending_directorio": "Directorio",
    "approved": "Aprobado",
    "rejected": "Rechazado",
    "voided": "Anulado",
}

QUARTER_RANGES = {
    1: ("Enero - Marzo", 1, 3),
    2: ("Abril - Junio", 4, 6),
    3: ("Julio - Septiembre", 7, 9),
    4: ("Octubre - Diciembre", 10, 12),
}

PENDING_STATUSES = ["pending_review", "pending_approval", "pending_directorio"]


def get_reports(db: Session, year: int | None = None) -> ReportsSummary:
    if year is None:
        year = date.today().year

    fy = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    if not fy:
        return _empty_reports(year)

    total_budget = float(fy.total_budget)

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fy.id)
        .order_by(BudgetItem.number)
        .all()
    )

    total_executed = sum(float(i.executed_amount) for i in items)
    total_available = total_budget - total_executed

    budget_execution = []
    for i in items:
        alloc = float(i.allocated_amount)
        exe = float(i.executed_amount)
        pct = round((exe / alloc) * 100, 1) if alloc > 0 else 0
        color = "red" if pct >= 100 else "yellow" if pct >= 80 else "green"
        budget_execution.append(BudgetExecution(
            item_number=i.number,
            item_name=i.name,
            allocated=alloc,
            executed=exe,
            available=alloc - exe,
            percentage=pct,
            status_color=color,
        ))

    monthly_rows = (
        db.query(
            extract("month", Expense.expense_date).label("month"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
            func.count(Expense.id).label("cnt"),
        )
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "approved")
        .group_by(extract("month", Expense.expense_date))
        .order_by(extract("month", Expense.expense_date))
        .all()
    )

    monthly_map = {int(r.month): (float(r.total), int(r.cnt)) for r in monthly_rows}
    monthly_expenses = []
    for m in range(1, 13):
        total, count = monthly_map.get(m, (0, 0))
        monthly_expenses.append(MonthlyExpense(
            month=m, month_name=MONTH_NAMES[m], total=total, count=count,
        ))

    company_rows = (
        db.query(
            Company.name,
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
            func.count(Expense.id).label("cnt"),
        )
        .join(Company, Expense.company_id == Company.id)
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "approved")
        .group_by(Company.name)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    grand_total_company = sum(float(r.total) for r in company_rows) or 1
    company_expenses = [
        CompanyExpense(
            company_name=r.name,
            total=float(r.total),
            count=int(r.cnt),
            percentage_of_total=round(float(r.total) / grand_total_company * 100, 1),
        )
        for r in company_rows
    ]

    supplier_rows = (
        db.query(
            func.coalesce(Expense.supplier_name, "Sin proveedor").label("supplier"),
            func.sum(Expense.amount).label("total"),
            func.count(Expense.id).label("cnt"),
        )
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "approved")
        .group_by(func.coalesce(Expense.supplier_name, "Sin proveedor"))
        .order_by(func.sum(Expense.amount).desc())
        .limit(10)
        .all()
    )

    top_suppliers = [
        TopSupplier(supplier_name=r.supplier, total=float(r.total), count=int(r.cnt))
        for r in supplier_rows
    ]

    status_rows = (
        db.query(
            Expense.status,
            func.count(Expense.id).label("cnt"),
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .filter(Expense.fiscal_year_id == fy.id)
        .group_by(Expense.status)
        .all()
    )

    status_breakdown = [
        StatusBreakdown(
            status=r.status,
            label=STATUS_LABELS.get(r.status, r.status),
            count=int(r.cnt),
            total=float(r.total),
        )
        for r in status_rows
    ]

    all_approved = (
        db.query(func.count(Expense.id), func.coalesce(func.avg(Expense.amount), 0))
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "approved")
        .first()
    )

    return ReportsSummary(
        fiscal_year=year,
        total_budget=total_budget,
        total_executed=total_executed,
        total_available=total_available,
        execution_percentage=round((total_executed / total_budget) * 100, 1) if total_budget else 0,
        monthly_expenses=monthly_expenses,
        budget_execution=budget_execution,
        company_expenses=company_expenses,
        top_suppliers=top_suppliers,
        status_breakdown=status_breakdown,
        avg_expense_amount=round(float(all_approved[1]), 0),
        total_expenses_count=int(all_approved[0]),
    )


def get_quarterly_balance(db: Session, year: int | None, quarter: int) -> QuarterlyBalance:
    if year is None:
        year = date.today().year
    if quarter not in QUARTER_RANGES:
        raise ValueError("quarter must be between 1 and 4")

    quarter_label, start_month, end_month = QUARTER_RANGES[quarter]
    start_date = date(year, start_month, 1)
    end_date = date(year, end_month, monthrange(year, end_month)[1])

    fy = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    if not fy:
        return _empty_quarterly_balance(year, quarter, quarter_label, start_date, end_date)

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fy.id)
        .order_by(BudgetItem.number)
        .all()
    )

    expense_rows = (
        db.query(
            Expense.budget_item_id,
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .filter(
            Expense.fiscal_year_id == fy.id,
            Expense.status == "approved",
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
        .group_by(Expense.budget_item_id)
        .all()
    )

    executed_by_item = {r.budget_item_id: float(r.total) for r in expense_rows}
    expenses_by_item = _build_budget_execution(items, executed_by_item)
    total_budget = float(fy.total_budget)
    total_expenses = sum(executed_by_item.values())
    total_income = _get_income_total(db, fy.id, start_date, end_date)

    return QuarterlyBalance(
        fiscal_year=year,
        quarter=quarter,
        quarter_label=quarter_label,
        period_start=start_date.isoformat(),
        period_end=end_date.isoformat(),
        total_budget=total_budget,
        total_income=total_income,
        total_expenses=total_expenses,
        balance=total_income - total_expenses,
        expenses_by_item=expenses_by_item,
        execution_percentage=round((total_expenses / total_budget) * 100, 1) if total_budget else 0,
    )


def get_annual_balance(db: Session, year: int | None) -> AnnualBalance:
    if year is None:
        year = date.today().year

    fy = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    quarterly_summary = [get_quarterly_balance(db, year, q) for q in range(1, 5)]

    if not fy:
        return AnnualBalance(
            fiscal_year=year,
            total_budget=0,
            total_income=0,
            total_expenses=0,
            final_balance=0,
            execution_percentage=0,
            quarterly_summary=quarterly_summary,
            expenses_by_item=[],
            bank_balances=[],
            pending_expenses=0,
            approved_expenses=0,
            voided_expenses=0,
        )

    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    total_budget = float(fy.total_budget)
    total_income = sum(q.total_income for q in quarterly_summary)
    total_expenses = sum(q.total_expenses for q in quarterly_summary)

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fy.id)
        .order_by(BudgetItem.number)
        .all()
    )
    expense_rows = (
        db.query(
            Expense.budget_item_id,
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
        .filter(
            Expense.fiscal_year_id == fy.id,
            Expense.status == "approved",
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
        .group_by(Expense.budget_item_id)
        .all()
    )
    executed_by_item = {r.budget_item_id: float(r.total) for r in expense_rows}

    bank_accounts = (
        db.query(BankAccount)
        .filter(BankAccount.is_active.is_(True))
        .order_by(BankAccount.alias)
        .all()
    )
    bank_balances = [
        BankBalance(account_name=account.alias, balance=float(account.balance))
        for account in bank_accounts
    ]

    pending_expenses = (
        db.query(func.count(Expense.id))
        .filter(Expense.fiscal_year_id == fy.id, Expense.status.in_(PENDING_STATUSES))
        .scalar()
        or 0
    )
    approved_expenses = (
        db.query(func.count(Expense.id))
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "approved")
        .scalar()
        or 0
    )
    voided_expenses = (
        db.query(func.count(Expense.id))
        .filter(Expense.fiscal_year_id == fy.id, Expense.status == "voided")
        .scalar()
        or 0
    )

    return AnnualBalance(
        fiscal_year=year,
        total_budget=total_budget,
        total_income=total_income,
        total_expenses=total_expenses,
        final_balance=total_income - total_expenses,
        execution_percentage=round((total_expenses / total_budget) * 100, 1) if total_budget else 0,
        quarterly_summary=quarterly_summary,
        expenses_by_item=_build_budget_execution(items, executed_by_item),
        bank_balances=bank_balances,
        pending_expenses=int(pending_expenses),
        approved_expenses=int(approved_expenses),
        voided_expenses=int(voided_expenses),
    )


def _build_budget_execution(
    items: list[BudgetItem],
    executed_by_item: dict[object, float],
) -> list[BudgetExecution]:
    budget_execution = []
    for item in items:
        allocated = float(item.allocated_amount)
        executed = executed_by_item.get(item.id, 0)
        percentage = round((executed / allocated) * 100, 1) if allocated > 0 else 0
        yellow_threshold = float(item.yellow_threshold)
        red_threshold = float(item.red_threshold)
        color = "red" if percentage >= red_threshold else "yellow" if percentage >= yellow_threshold else "green"
        budget_execution.append(BudgetExecution(
            item_number=item.number,
            item_name=item.name,
            allocated=allocated,
            executed=executed,
            available=allocated - executed,
            percentage=percentage,
            status_color=color,
        ))
    return budget_execution


def _get_income_total(db: Session, fiscal_year_id: object, start_date: date, end_date: date) -> float:
    try:
        from app.models.income import Income
    except ImportError:
        return 0

    total = (
        db.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(
            Income.fiscal_year_id == fiscal_year_id,
            Income.income_date >= start_date,
            Income.income_date <= end_date,
        )
        .scalar()
    )
    return float(total or 0)


def _empty_quarterly_balance(
    year: int,
    quarter: int,
    quarter_label: str,
    start_date: date,
    end_date: date,
) -> QuarterlyBalance:
    return QuarterlyBalance(
        fiscal_year=year,
        quarter=quarter,
        quarter_label=quarter_label,
        period_start=start_date.isoformat(),
        period_end=end_date.isoformat(),
        total_budget=0,
        total_income=0,
        total_expenses=0,
        balance=0,
        expenses_by_item=[],
        execution_percentage=0,
    )


def _empty_reports(year: int) -> ReportsSummary:
    return ReportsSummary(
        fiscal_year=year,
        total_budget=0,
        total_executed=0,
        total_available=0,
        execution_percentage=0,
        monthly_expenses=[
            MonthlyExpense(month=m, month_name=MONTH_NAMES[m], total=0, count=0)
            for m in range(1, 13)
        ],
        budget_execution=[],
        company_expenses=[],
        top_suppliers=[],
        status_breakdown=[],
        avg_expense_amount=0,
        total_expenses_count=0,
    )
