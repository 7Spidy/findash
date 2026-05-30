'use client'

import { motion } from 'framer-motion'
import { useAppState } from '@/context/AppContext'
import { formatINR, formatDate, daysUntil } from '@/lib/utils'
import type { CCSummary } from '@/types'

function ArcGauge({ pct }: { pct: number }) {
  const radius = 40
  const stroke = 6
  const cx = 50
  const cy = 50
  const circumference = Math.PI * radius
  const filled = Math.min(pct / 100, 1) * circumference

  const color = pct < 30 ? '#22c55e' : pct < 70 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 100 60" className="w-28 h-16">
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke="#E6E0D4"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="13" fontWeight="700" fill={color} fontFamily="DM Sans, sans-serif">
        {pct.toFixed(0)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#6B7280">
        utilisation
      </text>
    </svg>
  )
}

export default function CCHealthCard() {
  const { state } = useAppState()
  const ccStatements = state.parsed_statements.filter((s) => s.account_type === 'credit_card')

  if (ccStatements.length === 0) return null

  return (
    <div className="space-y-4">
      {ccStatements.map((stmt, i) => {
        const s = stmt.summary as CCSummary
        const utilPct = s.credit_limit > 0
          ? Math.round((s.total_outstanding / s.credit_limit) * 100)
          : 0
        const days = s.due_date ? daysUntil(s.due_date) : null
        const dueSeverity = days !== null && days <= 3 ? 'red' : days !== null && days <= 7 ? 'amber' : 'muted'

        // Top 3 merchants
        const merchantMap: Record<string, number> = {}
        for (const txn of stmt.transactions) {
          if (txn.txn_type === 'debit' && !txn.is_cc_bill_payment) {
            const m = txn.merchant_name || txn.description
            merchantMap[m] = (merchantMap[m] ?? 0) + txn.amount
          }
        }
        const topMerchants = Object.entries(merchantMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)

        return (
          <motion.div
            key={stmt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="rounded-2xl border p-5"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(123,63,0,0.10)', color: 'var(--color-accent)' }}
                >
                  {stmt.bank}
                </span>
                <p className="text-base font-semibold mt-2" style={{ color: 'var(--color-text)' }}>
                  {stmt.account_label}
                </p>
              </div>
              <ArcGauge pct={utilPct} />
            </div>

            <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4, color: 'var(--color-text)' }}>
              {formatINR(s.total_outstanding ?? 0)}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              outstanding of {formatINR(s.credit_limit ?? 0)} limit
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Min Due</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {formatINR(s.minimum_due ?? 0)}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Due Date</p>
                <p className="text-sm font-semibold" style={{ color: `var(--color-${dueSeverity === 'muted' ? 'text' : dueSeverity})` }}>
                  {s.due_date ? formatDate(s.due_date) : '—'}
                </p>
                {days !== null && (
                  <p className="text-xs" style={{ color: `var(--color-${dueSeverity === 'muted' ? 'text-muted' : dueSeverity})` }}>
                    {days <= 0 ? 'Overdue!' : `Due in ${days} day${days !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
            </div>

            {(s.cashback_earned > 0 || s.rewards_points > 0) && (
              <div className="flex gap-2 mb-4">
                {s.cashback_earned > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(123,63,0,0.10)', color: 'var(--color-accent)' }}>
                    ₹{s.cashback_earned} cashback
                  </span>
                )}
                {s.rewards_points > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-amber)' }}>
                    {s.rewards_points} pts
                  </span>
                )}
              </div>
            )}

            {topMerchants.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>Top merchants</p>
                <div className="space-y-1">
                  {topMerchants.map(([merchant, amount]) => (
                    <div key={merchant} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--color-text)' }}>{merchant}</span>
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{formatINR(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
