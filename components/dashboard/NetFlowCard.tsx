'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
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

  let totalCredits = 0
  let totalDebits = 0

  for (const stmt of state.parsed_statements) {
    const s = stmt.summary as SavingsSummary & CCSummary
    const credits = s.total_credits ?? 0
    const debits = s.total_debits ?? 0
    // Exclude CC bill payments — they appear as debits in savings statements
    const billPayments = stmt.transactions
      .filter((t) => t.is_cc_bill_payment)
      .reduce((sum, t) => sum + t.amount, 0)
    totalCredits += credits
    totalDebits += debits - billPayments
  }

  const net = totalCredits - totalDebits

  // Monthly net flow data for sparkline
  const monthlyMap: Record<string, { credits: number; debits: number }> = {}
  for (const stmt of state.parsed_statements) {
    const key = `${stmt.statement_year}-${String(stmt.statement_month).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { credits: 0, debits: 0 }
    const s = stmt.summary as SavingsSummary & CCSummary
    monthlyMap[key].credits += s.total_credits ?? 0
    monthlyMap[key].debits += s.total_debits ?? 0
  }

  const sparkData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { credits, debits }]) => ({
      month,
      net: Math.round(credits - debits),
    }))

  const animatedCredits = useCountUp(totalCredits)
  const animatedDebits = useCountUp(totalDebits)
  const animatedNet = useCountUp(Math.abs(net))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl border p-6"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <h2 className="text-sm font-medium uppercase tracking-wider mb-5" style={{ color: 'var(--color-text-muted)' }}>
        Net Cash Flow
      </h2>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Total Credits</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-green)' }}>
            {formatINR(animatedCredits)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Total Debits</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-red)' }}>
            {formatINR(animatedDebits)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Net Flow</p>
          <div className="flex items-center gap-1.5">
            {net >= 0
              ? <TrendingUp size={18} style={{ color: 'var(--color-accent)' }} />
              : <TrendingDown size={18} style={{ color: 'var(--color-red)' }} />
            }
            <p
              className="text-2xl font-bold"
              style={{
                fontFamily: 'Instrument Serif, serif',
                color: net >= 0 ? 'var(--color-accent)' : 'var(--color-red)',
              }}
            >
              {net < 0 ? '-' : ''}{formatINR(animatedNet)}
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
                dataKey="net"
                stroke={net >= 0 ? '#14b8a6' : '#ef4444'}
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                labelStyle={{ color: '#888', fontSize: 10 }}
                formatter={(v: number) => [formatINR(v), 'Net']}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  )
}
