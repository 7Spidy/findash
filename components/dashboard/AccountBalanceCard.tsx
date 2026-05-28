'use client'

import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'
import type { SavingsSummary } from '@/types'

export default function AccountBalanceCard() {
  const { state } = useAppState()
  const savingsStatements = state.parsed_statements.filter((s) => s.account_type === 'savings')

  if (savingsStatements.length === 0) return null

  return (
    <div className="space-y-4">
      {savingsStatements.map((stmt, i) => {
        const s = stmt.summary as SavingsSummary
        const delta = (s.closing_balance ?? 0) - (s.opening_balance ?? 0)

        return (
          <motion.div
            key={stmt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="rounded-2xl border p-5"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--color-accent)' }}
              >
                {stmt.bank}
              </span>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                Savings
              </p>
            </div>

            <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {stmt.account_label}
            </p>
            <p className="text-3xl font-bold mb-2" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-text)' }}>
              {formatINR(s.closing_balance ?? 0)}
            </p>

            <div className="flex items-center gap-1.5 mb-4">
              {delta >= 0
                ? <ArrowUp size={14} style={{ color: 'var(--color-green)' }} />
                : <ArrowDown size={14} style={{ color: 'var(--color-red)' }} />
              }
              <span className="text-sm" style={{ color: delta >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {delta >= 0 ? '+' : ''}{formatINR(delta)}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>vs opening</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Credits</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-green)' }}>
                  {formatINR(s.total_credits ?? 0)}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Debits</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-red)' }}>
                  {formatINR(s.total_debits ?? 0)}
                </p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
