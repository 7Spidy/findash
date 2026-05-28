import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { nanoid } from 'nanoid'
import { categorize } from '@/lib/categorizer'
import type { RawStatement, ParsedStatement, AIInsight, Transaction } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PARSE_PROMPT = `You are a financial statement parser for Indian bank and credit card statements. Extract all data from the following statement text and return ONLY valid JSON. No explanation, no markdown, no code blocks — raw JSON only.

Auto-detect whether this is a savings/current account or a credit card statement. Auto-detect the bank name and account type from the content. Pick the statement period (period_start, period_end) directly from the statement.

For savings/current account statements return:
{"account_type":"savings","bank":"","account_label":"","period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","statement_month":0,"statement_year":0,"summary":{"opening_balance":0.0,"closing_balance":0.0,"total_credits":0.0,"total_debits":0.0},"transactions":[{"txn_date":"YYYY-MM-DD","description":"","merchant_name":"","amount":0.0,"txn_type":"credit|debit","is_cc_bill_payment":false}]}

For credit card statements return:
{"account_type":"credit_card","bank":"","account_label":"","period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","statement_month":0,"statement_year":0,"summary":{"credit_limit":0.0,"total_outstanding":0.0,"minimum_due":0.0,"due_date":"YYYY-MM-DD","cashback_earned":0.0,"rewards_points":0,"total_credits":0.0,"total_debits":0.0},"transactions":[{"txn_date":"YYYY-MM-DD","description":"","merchant_name":"","amount":0.0,"txn_type":"credit|debit","is_cc_bill_payment":false}]}

Rules:
- merchant_name: clean normalised name (e.g. "SWIGGY*12345MUMBAI" → "Swiggy")
- is_cc_bill_payment: true ONLY on savings transactions where description suggests paying a credit card bill (keywords: "credit card", "CC bill", "NACH", "bill payment to")
- All amounts as positive floats
- If a field is not found in the statement, use null
- Return ONLY the JSON object`

const INSIGHTS_PROMPT = `You are a personal finance advisor analysing spending data for a user in India. The data covers one or more bank/credit card statements. Analyse the spend summary below and return a JSON array of insight objects. Return ONLY valid JSON — no explanation, no markdown.

Return insights of these types:
1. "subscription" — same merchant, similar amount, appears monthly. Include monthly_cost and annual_projection in the body.
2. "anomaly" — category spend notably higher than others or vs pattern.
3. "trend" — notable month-over-month change in a category.
4. "savings_tip" — specific, actionable, references real amounts from the data.
5. "cc_health" — credit utilisation status, due date warnings, cashback earned.

Schema for each insight object:
{"insight_type":"subscription|anomaly|trend|savings_tip|cc_health","title":"","body":"","severity":"info|warning|critical","is_discretionary":true|false,"related_merchant":"","related_amount":0.0,"period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD"}

Flag is_discretionary=true for entertainment OTT, gaming, lifestyle SaaS. Severity "critical" for CC due dates within 3 days or utilisation >70%. Return ONLY the JSON array. Minimum 4 insights, maximum 10.

Spend data:`

function repairTruncatedJSON(str: string): Record<string, unknown> | null {
  // Walk backwards from truncation point, try to close the JSON at each '}'
  const searchStart = Math.max(0, str.length - 1000)
  for (let i = str.length - 1; i >= searchStart; i--) {
    if (str[i] === '}') {
      // The transactions array is the last field, so we need to close it with ]}
      for (const suffix of [']}', ']', '']) {
        try {
          const candidate = str.slice(0, i + 1) + suffix
          const result = JSON.parse(candidate)
          if (result && typeof result === 'object') return result as Record<string, unknown>
        } catch { /* keep trying */ }
      }
    }
  }
  return null
}

async function parseStatement(statement: RawStatement): Promise<ParsedStatement> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: `${PARSE_PROMPT}\n\nStatement text:\n${statement.extracted_text.slice(0, 80000)}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'

  // Strip markdown code fences if Claude added them despite the prompt
  let jsonStr = raw.trim()
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) jsonStr = codeBlock[1].trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any = null

  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    const jsonMatch = jsonStr.match(/\{[\s\S]*/)
    if (jsonMatch) {
      const candidate = jsonMatch[0]
      try {
        parsed = JSON.parse(candidate)
      } catch {
        // Response was likely truncated at max_tokens — repair by closing the last complete transaction
        parsed = repairTruncatedJSON(candidate)
      }
    }
  }

  if (!parsed) {
    throw new Error(`Failed to parse statement JSON. Raw response (first 300 chars): ${raw.slice(0, 300)}`)
  }

  const id = nanoid()
  const transactions: Transaction[] = (parsed.transactions ?? []).map((txn: {
    txn_date: string
    description: string
    merchant_name: string
    amount: number
    txn_type: 'credit' | 'debit'
    is_cc_bill_payment: boolean
  }) => {
    const { category, subcategory } = categorize(txn.merchant_name ?? txn.description ?? '')
    return {
      id: nanoid(),
      txn_date: txn.txn_date ?? '',
      description: txn.description ?? '',
      merchant_name: txn.merchant_name ?? '',
      amount: txn.amount ?? 0,
      txn_type: txn.txn_type ?? 'debit',
      category,
      subcategory,
      category_source: 'auto' as const,
      is_cc_bill_payment: txn.is_cc_bill_payment ?? false,
      notes: '',
    }
  })

  return {
    id,
    file_name: statement.file_name,
    account_type: parsed.account_type ?? 'savings',
    bank: parsed.bank ?? 'Unknown Bank',
    account_label: parsed.account_label ?? statement.file_name,
    period_start: parsed.period_start ?? '',
    period_end: parsed.period_end ?? '',
    statement_month: parsed.statement_month ?? 0,
    statement_year: parsed.statement_year ?? 0,
    summary: parsed.summary ?? {},
    transactions,
    parse_status: transactions.length > 0 ? 'success' : 'partial',
  }
}

function buildSpendSummary(statements: ParsedStatement[]): object {
  const merchantTotals: Record<string, { total: number; count: number; months: string[] }> = {}
  const categoryTotals: Record<string, number> = {}
  const monthlyBreakdown: Record<string, { credits: number; debits: number }> = {}
  const ccUtilisation: Array<{ label: string; outstanding: number; limit: number; due_date: string }> = []

  for (const stmt of statements) {
    if (stmt.account_type === 'credit_card') {
      const s = stmt.summary as { total_outstanding?: number; credit_limit?: number; due_date?: string }
      ccUtilisation.push({
        label: stmt.account_label,
        outstanding: s.total_outstanding ?? 0,
        limit: s.credit_limit ?? 0,
        due_date: s.due_date ?? '',
      })
    }

    for (const txn of stmt.transactions) {
      if (txn.is_cc_bill_payment || txn.txn_type === 'credit') continue
      const month = txn.txn_date?.slice(0, 7) ?? 'unknown'
      if (!monthlyBreakdown[month]) monthlyBreakdown[month] = { credits: 0, debits: 0 }
      monthlyBreakdown[month].debits += txn.amount

      const merchant = txn.merchant_name || txn.description
      if (!merchantTotals[merchant]) merchantTotals[merchant] = { total: 0, count: 0, months: [] }
      merchantTotals[merchant].total += txn.amount
      merchantTotals[merchant].count += 1
      if (!merchantTotals[merchant].months.includes(month)) {
        merchantTotals[merchant].months.push(month)
      }

      categoryTotals[txn.category] = (categoryTotals[txn.category] ?? 0) + txn.amount
    }
  }

  const topMerchants = Object.entries(merchantTotals)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 20)
    .map(([merchant, data]) => ({ merchant, ...data }))

  return { merchant_totals: topMerchants, category_totals: categoryTotals, monthly_breakdown: monthlyBreakdown, cc_utilisation: ccUtilisation }
}

async function generateInsights(statements: ParsedStatement[]): Promise<AIInsight[]> {
  const spendSummary = buildSpendSummary(statements)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `${INSIGHTS_PROMPT}\n${JSON.stringify(spendSummary, null, 2)}`,
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  let insights
  try {
    insights = JSON.parse(raw.trim())
  } catch {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      insights = JSON.parse(jsonMatch[0])
    } else {
      insights = []
    }
  }

  return (Array.isArray(insights) ? insights : []).map((ins: Omit<AIInsight, 'id' | 'dismissed'>) => ({
    id: nanoid(),
    ...ins,
    dismissed: false,
  }))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const statements: RawStatement[] = body.statements

    if (!statements || statements.length === 0) {
      return NextResponse.json({ error: 'No statements provided' }, { status: 400 })
    }

    const parsed_statements: ParsedStatement[] = []
    for (const stmt of statements) {
      const parsed = await parseStatement(stmt)
      parsed_statements.push(parsed)
    }

    const insights = await generateInsights(parsed_statements)

    return NextResponse.json({ parsed_statements, insights })
  } catch (err) {
    console.error('Analysis error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
