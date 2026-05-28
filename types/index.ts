export type AccountType = 'savings' | 'credit_card'

export interface RawStatement {
  file_name: string
  extracted_text: string
  password_used: boolean
}

export interface Transaction {
  id: string
  txn_date: string
  description: string
  merchant_name: string
  amount: number
  txn_type: 'credit' | 'debit'
  category: string
  subcategory: string
  category_source: 'auto' | 'manual' | 'ai'
  is_cc_bill_payment: boolean
  notes: string
}

export interface SavingsSummary {
  opening_balance: number
  closing_balance: number
  total_credits: number
  total_debits: number
}

export interface CCSummary {
  credit_limit: number
  total_outstanding: number
  minimum_due: number
  due_date: string
  cashback_earned: number
  rewards_points: number
  total_credits: number
  total_debits: number
}

export interface ParsedStatement {
  id: string
  file_name: string
  account_type: AccountType
  bank: string
  account_label: string
  period_start: string
  period_end: string
  statement_month: number
  statement_year: number
  summary: SavingsSummary | CCSummary
  transactions: Transaction[]
  parse_status: 'success' | 'partial' | 'failed'
}

export type InsightType =
  | 'subscription'
  | 'anomaly'
  | 'trend'
  | 'savings_tip'
  | 'cc_health'

export interface AIInsight {
  id: string
  insight_type: InsightType
  title: string
  body: string
  severity: 'info' | 'warning' | 'critical'
  is_discretionary: boolean
  related_merchant: string
  related_amount: number
  period_start: string
  period_end: string
  dismissed: boolean
}

export interface AppState {
  raw_statements: RawStatement[]
  parsed_statements: ParsedStatement[]
  insights: AIInsight[]
  analysis_status: 'idle' | 'extracting' | 'analysing' | 'done' | 'error'
  error_message: string
}
