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
