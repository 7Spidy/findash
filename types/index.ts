// ─── Core transaction type ───────────────────────────────────────────────────

export type TransactionType = "credit" | "debit";

export type Account = "HDFC" | "ICICI";

export type CreditCard = "SBI_CC" | "ICICI_CC";

export type Source =
  | "HDFC"
  | "ICICI"
  | "SBI_CC"
  | "ICICI_CC";

export type RawSource =
  | "email_alert"
  | "sms_forward"
  | "bank_statement"
  | "cc_statement";

export type Category =
  | "Food & Dining"
  | "Transport"
  | "Shopping"
  | "Entertainment"
  | "Health & Fitness"
  | "Subscriptions"
  | "Utilities"
  | "Transfers"
  | "Others";

export interface Transaction {
  id: string;
  date: string;           // ISO date string "YYYY-MM-DD"
  amount: number;
  type: TransactionType;
  account: Source;
  description: string;
  merchant: string;
  category: Category;
  raw_source: RawSource;
  currency: "INR";
  upi_ref?: string;       // UPI reference ID if available
}

// ─── Account summary ─────────────────────────────────────────────────────────

export interface MonthlyFlow {
  month: string;          // "2026-04"
  credit: number;
  debit: number;
  net: number;
}

export interface AccountSummary {
  id: Account;
  name: string;
  balance: number;
  as_of: string;          // ISO date
  this_month_credit: number;
  this_month_debit: number;
  last_month_credit: number;
  last_month_debit: number;
  monthly_flow: MonthlyFlow[];
  recent_transactions: string[];  // transaction IDs, latest 10
}

export interface AccountsData {
  accounts: AccountSummary[];
  last_updated: string;
}

// ─── Credit card summary ─────────────────────────────────────────────────────

export interface CreditCardSummary {
  id: CreditCard;
  name: string;
  bank: string;
  credit_limit: number;
  outstanding: number;
  minimum_due: number;
  total_due: number;
  due_date: string;       // ISO date
  statement_date: string;
  this_cycle_spend: number;
  last_cycle_spend: number;
  utilization_pct: number;
  monthly_spend: MonthlyFlow[];
}

export interface CreditCardsData {
  cards: CreditCardSummary[];
  last_updated: string;
}

// ─── Insights (AI-generated) ─────────────────────────────────────────────────

export interface SpendAlert {
  type: "unused_subscription" | "spike" | "duplicate" | "large_single";
  title: string;
  description: string;
  estimated_saving?: number;
}

export interface Subscription {
  name: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "annual";
  last_charged: string;
  category: Category;
}

export interface CategoryInsight {
  category: Category;
  this_month: number;
  last_month: number;
  avg_3m: number;
  change_pct: number;
}

export interface InsightsData {
  generated_at: string;
  alerts: SpendAlert[];
  subscriptions: Subscription[];
  tips: string[];
  category_insights: CategoryInsight[];
  top_merchants: { merchant: string; total: number; count: number }[];
}

// ─── Last updated metadata ───────────────────────────────────────────────────

export interface LastUpdated {
  timestamp: string;
  emails_fetched: number;
  transactions_added: number;
  parse_errors: number;
  pipeline_version: string;
}
