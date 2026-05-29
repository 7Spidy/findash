'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'

const ACCOUNT_COLORS = ['#14b8a6', '#3b82f6', '#a855f7', '#f97316', '#22c55e']

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining':  '#f97316',
  'Transport':      '#3b82f6',
  'Shopping':       '#a855f7',
  'Entertainment':  '#ec4899',
  'Subscriptions':  '#6366f1',
  'Utilities':      '#eab308',
  'Travel':         '#14b8a6',
  'Investments':    '#22c55e',
  'Health':         '#ef4444',
  'Others':         '#6b7280',
}

interface MonthlyBarChartProps {
  onMonthSelect?: (month: string | null) => void
}

export default function MonthlyBarChart({ onMonthSelect }: MonthlyBarChartProps) {
  const { state } = useAppState()
  const [mode, setMode] = useState<'account' | 'category'>('account')

  // Build monthly data
  type MonthData = { month: string; displayMonth: string; [key: string]: number | string }
  const monthlyMap: Record<string, MonthData> = {}

  for (const stmt of state.parsed_statements) {
    const key = `${stmt.statement_year}-${String(stmt.statement_month).padStart(2, '0')}`
    if (!monthlyMap[key]) {
      monthlyMap[key] = {
        month: key,
        displayMonth: new Date(stmt.statement_year, stmt.statement_month - 1, 1)
          .toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      }
    }

    for (const txn of stmt.transactions) {
      if (txn.is_cc_bill_payment || txn.txn_type === 'credit') continue

      if (mode === 'account') {
        const label = stmt.account_label
        monthlyMap[key][label] = ((monthlyMap[key][label] as number) ?? 0) + txn.amount
      } else {
        monthlyMap[key][txn.category] = ((monthlyMap[key][txn.category] as number) ?? 0) + txn.amount
      }
    }
  }

  const chartData = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month))

  const allKeys = mode === 'account'
    ? [...new Set(state.parsed_statements.map((s) => s.account_label))]
    : [...new Set(state.parsed_statements.flatMap((s) =>
        s.transactions
          .filter((t) => !t.is_cc_bill_payment && t.txn_type === 'debit')
          .map((t) => t.category)
      ))]

  const handleBarClick = (data: { month: string }) => {
    onMonthSelect?.(data.month)
  }

  const yAxisFormatter = (v: number) => formatINR(v, true)

  return (
    <motion.div
      id="monthly-bar-chart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border p-5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Monthly Breakdown
        </h3>
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          {(['account', 'category'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1 text-xs font-medium transition-colors capitalize"
              style={{
                background: mode === m ? 'var(--color-accent)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              By {m === 'account' ? 'Account' : 'Category'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} onClick={(d) => d?.activePayload && handleBarClick(d.activePayload[0].payload)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="displayMonth" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={yAxisFormatter} tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 12,
                color: '#f5f5f5',
              }}
              labelStyle={{ color: '#888', fontSize: 11 }}
              itemStyle={{ color: '#f5f5f5' }}
              formatter={(v: number) => formatINR(v)}
              cursor={{ fill: 'rgba(255,255,255,0.07)' }}
            />
            <Legend
              formatter={(v) => <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{v}</span>}
            />
            {allKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId={mode === 'category' ? 'a' : undefined}
                fill={mode === 'account' ? ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] : (CATEGORY_COLORS[key] ?? '#6b7280')}
                radius={mode === 'category' ? undefined : [4, 4, 0, 0]}
                animationDuration={800}
                animationBegin={i * 100}
              >
                {mode === 'account' && chartData.map((entry, idx) => (
                  <Cell key={idx} fill={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
