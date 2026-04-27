from datetime import date

from sqlalchemy import func, case, extract
from sqlalchemy.orm import Session

from app.models.budget_item import BudgetItem
from app.models.company import Company
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.schemas.reports import (
    BudgetExecution,
    CompanyExpense,
    MonthlyExpense,
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
