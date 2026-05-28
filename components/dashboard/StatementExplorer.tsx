'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR, formatShortDate } from '@/lib/utils'

export default function StatementExplorer() {
  const { state } = useAppState()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searches, setSearches] = useState<Record<string, string>>({})
  type SortKey = 'txn_date' | 'merchant_name' | 'amount' | 'txn_type' | 'category'
  const [sortKeys, setSortKeys] = useState<Record<string, { key: SortKey; dir: 'asc' | 'desc' }>>({})

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          Statement Explorer
        </h3>
      </div>

      {state.parsed_statements.map((stmt) => {
        const isExpanded = expandedIds.has(stmt.id)
        const search = searches[stmt.id] ?? ''
        const sortCfg = sortKeys[stmt.id] ?? { key: 'txn_date', dir: 'asc' }

        const txns = stmt.transactions
          .filter((t) => {
            if (!search) return true
            const q = search.toLowerCase()
            return (
              t.merchant_name.toLowerCase().includes(q) ||
              t.description.toLowerCase().includes(q) ||
              t.category.toLowerCase().includes(q)
            )
          })
          .sort((a, b) => {
            const av = a[sortCfg.key] as string | number
            const bv = b[sortCfg.key] as string | number
            const cmp = av < bv ? -1 : av > bv ? 1 : 0
            return sortCfg.dir === 'asc' ? cmp : -cmp
          })

        const totalSpend = stmt.transactions
          .filter((t) => t.txn_type === 'debit' && !t.is_cc_bill_payment)
          .reduce((s, t) => s + t.amount, 0)

        const handleSort = (key: SortKey) => {
          setSortKeys((prev) => {
            const cur = prev[stmt.id]
            if (cur?.key === key) {
              return { ...prev, [stmt.id]: { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } }
            }
            return { ...prev, [stmt.id]: { key, dir: 'asc' } }
          })
        }

        const SortIcon = ({ k }: { k: SortKey }) => (
          <span className="ml-1 opacity-50" style={{ color: sortCfg.key === k ? 'var(--color-accent)' : undefined }}>
            {sortCfg.key === k ? (sortCfg.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )

        return (
          <div key={stmt.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:opacity-80"
              onClick={() => toggleExpand(stmt.id)}
            >
              <div className="flex items-center gap-3">
                {isExpanded
                  ? <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />
                  : <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                }
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {stmt.account_label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {stmt.period_start} – {stmt.period_end}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{stmt.transactions.length} txns</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{formatINR(totalSpend)}</p>
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="px-5 pb-3 pt-1">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border mb-3 w-56"
                      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
                      <Search size={12} style={{ color: 'var(--color-text-muted)' }} />
                      <input
                        value={search}
                        onChange={(e) => setSearches((prev) => ({ ...prev, [stmt.id]: e.target.value }))}
                        placeholder="Search transactions..."
                        className="text-xs bg-transparent outline-none flex-1"
                        style={{ color: 'var(--color-text)' }}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                          {([
                            { label: 'Date', key: 'txn_date' as SortKey },
                            { label: 'Merchant', key: 'merchant_name' as SortKey },
                            { label: 'Amount', key: 'amount' as SortKey },
                            { label: 'Type', key: 'txn_type' as SortKey },
                            { label: 'Category', key: 'category' as SortKey },
                          ]).map(({ label, key }) => (
                            <th
                              key={key}
                              className="py-2 px-4 text-left text-xs font-medium cursor-pointer select-none"
                              style={{ color: 'var(--color-text-muted)' }}
                              onClick={() => handleSort(key)}
                            >
                              {label} <SortIcon k={key} />
                            </th>
                          ))}
                          <th className="py-2 px-4 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((txn) => (
                          <tr key={txn.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td className="py-2 px-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {formatShortDate(txn.txn_date)}
                            </td>
                            <td className="py-2 px-4 text-xs max-w-xs truncate" style={{ color: 'var(--color-text)' }}>
                              {txn.merchant_name || txn.description}
                            </td>
                            <td
                              className="py-2 px-4 text-xs font-medium"
                              style={{ color: txn.txn_type === 'credit' ? 'var(--color-green)' : 'var(--color-text)' }}
                            >
                              {txn.txn_type === 'credit' ? '+' : ''}{formatINR(txn.amount)}
                            </td>
                            <td className="py-2 px-4">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full capitalize"
                                style={{
                                  background: txn.txn_type === 'credit' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: txn.txn_type === 'credit' ? 'var(--color-green)' : 'var(--color-red)',
                                }}
                              >
                                {txn.txn_type}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {txn.category}
                            </td>
                            <td className="py-2 px-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              {txn.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </motion.div>
  )
}
