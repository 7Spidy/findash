'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, CreditCard, Wallet } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'
import type { SavingsSummary, CCSummary } from '@/types'

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const start = Date.now()
    let rafId: number
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return value
}

export default function NetFlowCard() {
  const { state } = useAppState()

  const hasSavings = state.parsed_statements.some((s) => s.account_type === 'savings')
  const hasCC      = state.parsed_statements.some((s) => s.account_type === 'credit_card')
  const ccOnly     = !hasSavings && hasCC

  let totalIncome      = 0  // savings credits
  let totalSpend       = 0  // all debits (excl. CC bill payments) — the "real" spend
  let ccTotalOutstanding = 0
  let ccPayments       = 0  // credits to CC accounts = payments received by card

  for (const stmt of state.parsed_statements) {
    const s = stmt.summary as SavingsSummary & CCSummary
    const billPayments = stmt.transactions
      .filter((t) => t.is_cc_bill_payment)
      .reduce((sum, t) => sum + t.amount, 0)

    if (stmt.account_type === 'savings') {
      totalIncome += s.total_credits ?? 0
      totalSpend  += (s.total_debits ?? 0) - billPayments
    } else {
      totalSpend         += s.total_debits ?? 0   // CC charges = actual spend
      ccPayments         += s.total_credits ?? 0  // payments made to card
      ccTotalOutstanding += s.total_outstanding ?? 0
    }
  }

  const netSaved = totalIncome - totalSpend

  // Monthly sparkline — spend for CC-only, net savings otherwise
  const monthlyMap: Record<string, { spend: number; income: number }> = {}
  for (const stmt of state.parsed_statements) {
    const key = `${stmt.statement_year}-${String(stmt.statement_month).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { spend: 0, income: 0 }
    const s = stmt.summary as SavingsSummary & CCSummary
    if (stmt.account_type === 'savings') {
      monthlyMap[key].income += s.total_credits ?? 0
      const bills = stmt.transactions
        .filter((t) => t.is_cc_bill_payment)
        .reduce((sum, t) => sum + t.amount, 0)
      monthlyMap[key].spend += (s.total_debits ?? 0) - bills
    } else {
      monthlyMap[key].spend += s.total_debits ?? 0
    }
  }

  const sparkData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { spend, income }]) => ({
      month,
      value: ccOnly ? Math.round(spend) : Math.round(income - spend),
    }))

  // Choose which three metrics to display depending on statement mix
  const colA = ccOnly
    ? { label: 'Total Spend',        amount: totalSpend,          color: 'var(--color-red)'    }
    : { label: 'Total Income',       amount: totalIncome,         color: 'var(--color-green)'  }

  const colB = ccOnly
    ? { label: 'Payments Received',  amount: ccPayments,          color: 'var(--color-green)'  }
    : { label: 'Total Spend',        amount: totalSpend,          color: 'var(--color-red)'    }

  const colC = ccOnly
    ? { label: 'Outstanding',        amount: ccTotalOutstanding,  color: 'var(--color-amber)'  }
    : { label: 'Net Saved',          amount: Math.abs(netSaved),  color: netSaved >= 0 ? 'var(--color-accent)' : 'var(--color-red)' }

  const title = ccOnly ? 'Credit Card Overview' : hasSavings && hasCC ? 'Cash Flow Overview' : 'Net Cash Flow'

  const animA = useCountUp(colA.amount)
  const animB = useCountUp(colB.amount)
  const animC = useCountUp(colC.amount)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border p-6"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        {ccOnly
          ? <CreditCard size={13} style={{ color: 'var(--color-text-muted)' }} />
          : <Wallet size={13} style={{ color: 'var(--color-text-muted)' }} />
        }
        <h2 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Column A */}
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{colA.label}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: colA.color }}>
            {formatINR(animA)}
          </p>
        </div>

        {/* Column B */}
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{colB.label}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: colB.color }}>
            {formatINR(animB)}
          </p>
        </div>

        {/* Column C */}
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{colC.label}</p>
          <div className="flex items-center gap-1.5">
            {!ccOnly && (
              netSaved >= 0
                ? <TrendingUp  size={18} style={{ color: 'var(--color-accent)' }} />
                : <TrendingDown size={18} style={{ color: 'var(--color-red)' }} />
            )}
            <p className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: colC.color }}>
              {!ccOnly && netSaved < 0 ? '−' : ''}{formatINR(animC)}
            </p>
          </div>
        </div>
      </div>

      {sparkData.length > 1 && (
        <div className="h-16 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={ccOnly ? '#ef4444' : netSaved >= 0 ? '#14b8a6' : '#ef4444'}
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                labelStyle={{ color: '#888', fontSize: 10 }}
                formatter={(v: number) => [formatINR(v), ccOnly ? 'Spend' : 'Net Saved']}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}
