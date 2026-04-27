export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string | null;
  area: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FiscalYear {
  id: string;
  year: number;
  total_budget: number;
  status: string;
  approved_at: string | null;
  imm_value: number;
  notes: string | null;
}

export interface BudgetItem {
  id: string;
  fiscal_year_id: string;
  number: number;
  name: string;
  authority: string;
  fund_source: string;
  allocated_amount: number;
  executed_amount: number;
  available_amount: number;
  execution_percentage: number;
  status_color: "green" | "yellow" | "red";
  yellow_threshold: number;
  red_threshold: number;
  is_blocked: boolean;
}

export interface ApprovalStep {
  id: string;
  step_order: number;
  role_required: string;
  label: string;
  status: string;
  acted_by_name: string | null;
  acted_at: string | null;
}

export interface Expense {
  id: string;
  budget_item_id: string;
  fiscal_year_id: string;
  company_id: string | null;
  amount: number;
  description: string;
  supplier_rut: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  expense_date: string;
  status: string;
  requires_quotations: boolean;
  has_reception_act: boolean;
  authorized_by_superintendent: boolean;
  requested_by_id: string;
  approved_by_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  budget_item_name: string | null;
  requested_by_name: string | null;
  approval_steps: ApprovalStep[];
}

export interface Income {
  id: string;
  fiscal_year_id: string;
  source_type: string;
  source_detail: string | null;
  amount: number;
  income_date: string;
  reference: string | null;
  company_id: string | null;
  notes: string | null;
  created_by_id: string;
  created_at: string;
  source_type_label: string;
  company_name: string | null;
  created_by_name: string | null;
}

export interface Document {
  id: string;
  expense_id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  uploaded_by_id: string;
  created_at: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface DashboardSummary {
  fiscal_year: number;
  fiscal_year_status: string;
  total_budget: number;
  total_executed: number;
  total_available: number;
  execution_percentage: number;
  total_bank_balance: number;
  expenses_this_month: number;
  expenses_count_this_month: number;
  pending_approvals: number;
  budget_items: BudgetItem[];
  recent_alerts: Alert[];
  items_in_red: number;
  items_in_yellow: number;
  items_in_green: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Company {
  id: string;
  number: number;
  name: string;
  is_active: boolean;
}

export interface Asset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  serial_number: string | null;
  company_id: string | null;
  company_name: string | null;
  acquisition_date: string | null;
  acquisition_value: number | null;
  current_condition: string;
  location: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetSummary {
  total_assets: number;
  total_value: number;
  active_count: number;
  baja_count: number;
  by_category: Record<string, number>;
}

export interface MonthlyExpense {
  month: number;
  month_name: string;
  total: number;
  count: number;
}

export interface BudgetExecution {
  item_number: number;
  item_name: string;
  allocated: number;
  executed: number;
  available: number;
  percentage: number;
  status_color: string;
}

export interface CompanyExpense {
  company_name: string;
  total: number;
  count: number;
  percentage_of_total: number;
}

export interface TopSupplier {
  supplier_name: string;
  total: number;
  count: number;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
  total: number;
}

export interface ReportsSummary {
  fiscal_year: number;
  total_budget: number;
  total_executed: number;
  total_available: number;
  execution_percentage: number;
  monthly_expenses: MonthlyExpense[];
  budget_execution: BudgetExecution[];
  company_expenses: CompanyExpense[];
  top_suppliers: TopSupplier[];
  status_breakdown: StatusBreakdown[];
  avg_expense_amount: number;
  total_expenses_count: number;
}

export interface QuarterlyBalance {
  fiscal_year: number;
  quarter: number;
  quarter_label: string;
  period_start: string;
  period_end: string;
  total_budget: number;
  total_income: number;
  total_expenses: number;
  balance: number;
  expenses_by_item: BudgetExecution[];
  execution_percentage: number;
}

export interface AnnualBalance {
  fiscal_year: number;
  total_budget: number;
  total_income: number;
  total_expenses: number;
  final_balance: number;
  execution_percentage: number;
  quarterly_summary: QuarterlyBalance[];
  expenses_by_item: BudgetExecution[];
  bank_balances: { account_name: string; balance: number }[];
  pending_expenses: number;
  approved_expenses: number;
  voided_expenses: number;
}

export interface AiQueryRequest {
  question: string;
  year?: number;
  thread_id?: string | null;
}

export interface AiSource {
  entity_type: string;
  label: string;
  entity_id: string | null;
  detail: string | null;
}

export interface AiFinding {
  code: string;
  severity: string;
  message: string;
  source: AiSource | null;
}

export interface AiToolCall {
  name: string;
  args: Record<string, unknown>;
  result_summary: string;
}

export interface AiProposedAction {
  action_type: string;
  label: string;
  requires_human_review: boolean;
}

export interface AiQueryResponse {
  run_id: string;
  thread_id: string;
  status: string;
  intent: string;
  answer: string;
  confidence: number | null;
  sources: AiSource[];
  findings: AiFinding[];
  proposed_actions: AiProposedAction[];
  tool_calls: AiToolCall[];
}

export interface AiRunListItem {
  id: string;
  thread_id: string;
  user_id: string;
  status: string;
  intent: string;
  question: string | null;
  confidence: number | null;
  final_response: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AiRunResponse {
  id: string;
  thread_id: string;
  user_id: string;
  status: string;
  intent: string;
  input_payload: Record<string, unknown>;
  user_context: Record<string, unknown>;
  domain_context: Record<string, unknown>;
  policy_context: Record<string, unknown>;
  tool_calls: unknown[];
  findings: unknown[];
  confidence: number | null;
  proposed_actions: unknown[];
  human_review: Record<string, unknown> | null;
  final_response: string | null;
  audit_trace: unknown[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
