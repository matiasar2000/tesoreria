from pydantic import BaseModel

from app.schemas.alert import AlertResponse
from app.schemas.budget_item import BudgetItemResponse


class BankBalanceSummary(BaseModel):
    name: str
    balance: float


class DashboardSummary(BaseModel):
    fiscal_year: int
    fiscal_year_status: str
    total_budget: float
    total_executed: float
    total_available: float
    execution_percentage: float
    total_bank_balance: float
    bank_accounts: list[BankBalanceSummary]
    expenses_this_month: float
    expenses_count_this_month: int
    pending_approvals: int
    budget_items: list[BudgetItemResponse]
    recent_alerts: list[AlertResponse]
    items_in_red: int
    items_in_yellow: int
    items_in_green: int
