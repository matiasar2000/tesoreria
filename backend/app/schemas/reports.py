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


class QuarterlyBalance(BaseModel):
    fiscal_year: int
    quarter: int
    quarter_label: str
    period_start: str
    period_end: str
    total_budget: float
    total_income: float
    total_expenses: float
    balance: float
    expenses_by_item: list[BudgetExecution]
    execution_percentage: float


class BankBalance(BaseModel):
    account_name: str
    balance: float


class AnnualBalance(BaseModel):
    fiscal_year: int
    total_budget: float
    total_income: float
    total_expenses: float
    final_balance: float
    execution_percentage: float
    quarterly_summary: list[QuarterlyBalance]
    expenses_by_item: list[BudgetExecution]
    bank_balances: list[BankBalance]
    pending_expenses: int
    approved_expenses: int
    voided_expenses: int


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
