from pydantic import BaseModel


class MonthlyExpense(BaseModel):
    month: int
    month_name: str
    total: float
    count: int


class BudgetExecution(BaseModel):
    item_number: int
    item_name: str
    allocated: float
    executed: float
    available: float
    percentage: float
    status_color: str


class CompanyExpense(BaseModel):
    company_name: str
    total: float
    count: int
    percentage_of_total: float


class TopSupplier(BaseModel):
    supplier_name: str
    total: float
    count: int


class StatusBreakdown(BaseModel):
    status: str
    label: str
    count: int
    total: float


class ReportsSummary(BaseModel):
    fiscal_year: int
    total_budget: float
    total_executed: float
    total_available: float
    execution_percentage: float
    monthly_expenses: list[MonthlyExpense]
    budget_execution: list[BudgetExecution]
    company_expenses: list[CompanyExpense]
    top_suppliers: list[TopSupplier]
    status_breakdown: list[StatusBreakdown]
    avg_expense_amount: float
    total_expenses_count: int
