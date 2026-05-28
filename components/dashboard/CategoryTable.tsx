'use client'

import { useState, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR, formatShortDate } from '@/lib/utils'
import type { Transaction } from '@/types'

const ALL_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Subscriptions', 'Utilities', 'Travel', 'Investments', 'Health', 'Others',
]

interface CategoryTableProps {
  filterCategory?: string | null
  filterMonth?: string | null
  onFilterClear?: () => void
}

interface TxnRowProps {
  txn: Transaction
  statementId: string
}

function TxnRow({ txn, statementId }: TxnRowProps) {
  const { dispatch } = useAppState()
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(txn.notes)

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {formatShortDate(txn.txn_date)}
      </td>
      <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-text)' }}>
        {txn.merchant_name || txn.description}
      </td>
      <td className="py-2 px-3 text-xs font-medium text-right" style={{ color: txn.txn_type === 'credit' ? 'var(--color-green)' : 'var(--color-text)' }}>
        {txn.txn_type === 'credit' ? '+' : '-'}{formatINR(txn.amount)}
      </td>
      <td className="py-2 px-3">
        <select
          value={txn.category}
          onChange={(e) => dispatch({
            type: 'UPDATE_TRANSACTION',
            payload: { statement_id: statementId, txn_id: txn.id, category: e.target.value },
          })}
          className="text-xs rounded-lg px-2 py-0.5 border outline-none"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-2 px-3">
        {editing ? (
          <input
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              dispatch({ type: 'UPDATE_TRANSACTION', payload: { statement_id: statementId, txn_id: txn.id, notes } })
              setEditing(false)
            }}
            className="text-xs w-full rounded px-1 py-0.5 border outline-none"
            style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-accent)', color: 'var(--color-text)' }}
          />
        ) : (
          <span
            className="text-xs cursor-pointer"
            style={{ color: notes ? 'var(--color-text-muted)' : 'var(--color-border)' }}
            onClick={() => setEditing(true)}
          >
            {notes || 'Add note...'}
          </span>
        )}
      </td>
    </tr>
  )
}

export default function CategoryTable({ filterCategory, filterMonth, onFilterClear }: CategoryTableProps) {
  const { state } = useAppState()
  const [search, setSearch] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<'total' | 'count' | 'avg'>('total')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const allTxns = useMemo(() => {
    return state.parsed_statements.flatMap((s) =>
      s.transactions
        .filter((t) => !t.is_cc_bill_payment && t.txn_type === 'debit')
        .map((t) => ({ ...t, statementId: s.id }))
    )
  }, [state.parsed_statements])

  const filtered = useMemo(() => {
    return allTxns.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false
      if (filterMonth) {
        const txnMonth = t.txn_date?.slice(0, 7)
        if (txnMonth !== filterMonth) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          t.merchant_name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allTxns, filterCategory, filterMonth, search])

  const totalSpend = filtered.reduce((s, t) => s + t.amount, 0)

  // Group by category → subcategory
  type CatData = {
    category: string
    total: number
    count: number
    subs: Record<string, { total: number; count: number; txns: (Transaction & { statementId: string })[] }>
  }

  const grouped = useMemo(() => {
    const map: Record<string, CatData> = {}
    for (const t of filtered) {
      if (!map[t.category]) map[t.category] = { category: t.category, total: 0, count: 0, subs: {} }
      map[t.category].total += t.amount
      map[t.category].count += 1
      const sub = t.subcategory || 'General'
      if (!map[t.category].subs[sub]) map[t.category].subs[sub] = { total: 0, count: 0, txns: [] }
      map[t.category].subs[sub].total += t.amount
      map[t.category].subs[sub].count += 1
      map[t.category].subs[sub].txns.push(t)
    }
    return Object.values(map).sort((a, b) => {
      const av = sortKey === 'total' ? a.total : sortKey === 'count' ? a.count : a.total / a.count
      const bv = sortKey === 'total' ? b.total : sortKey === 'count' ? b.count : b.total / b.count
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortKey, sortDir])

  const toggleCat = (cat: string) => setExpandedCats((prev) => {
    const next = new Set(prev)
    next.has(cat) ? next.delete(cat) : next.add(cat)
    return next
  })

  const toggleSub = (key: string) => setExpandedSubs((prev) => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ k }: { k: typeof sortKey }) => (
    <span className="ml-1 opacity-60" style={{ color: sortKey === k ? 'var(--color-accent)' : undefined }}>
      {sortKey === k ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="p-5 border-b flex flex-wrap items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-medium uppercase tracking-wider flex-1" style={{ color: 'var(--color-text-muted)' }}>
          Category Breakdown
        </h3>

        {/* Active filters */}
        <div className="flex gap-2 flex-wrap">
          {filterCategory && (
            <span
              className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--color-accent)' }}
              onClick={onFilterClear}
            >
              {filterCategory} <X size={10} />
            </span>
          )}
          {filterMonth && (
            <span
              className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer"
              style={{ background: 'rgba(20,184,166,0.12)', color: 'var(--color-accent)' }}
              onClick={onFilterClear}
            >
              {filterMonth} <X size={10} />
            </span>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-2)' }}>
          <Search size={13} style={{ color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="text-sm bg-transparent outline-none w-32"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
              <th className="py-3 px-4 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Category</th>
              <th
                className="py-3 px-4 text-right text-xs font-medium cursor-pointer select-none"
                style={{ color: 'var(--color-text-muted)' }}
                onClick={() => handleSort('total')}
              >
                Total <SortIcon k="total" />
              </th>
              <th className="py-3 px-4 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>% of Spend</th>
              <th
                className="py-3 px-4 text-right text-xs font-medium cursor-pointer select-none"
                style={{ color: 'var(--color-text-muted)' }}
                onClick={() => handleSort('count')}
              >
                Txns <SortIcon k="count" />
              </th>
              <th
                className="py-3 px-4 text-right text-xs font-medium cursor-pointer select-none"
                style={{ color: 'var(--color-text-muted)' }}
                onClick={() => handleSort('avg')}
              >
                Avg/Txn <SortIcon k="avg" />
              </th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((cat) => (
              <Fragment key={cat.category}>
                <tr
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => toggleCat(cat.category)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {expandedCats.has(cat.category)
                        ? <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                        : <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                      }
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {cat.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-semibold" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-text)' }}>
                    {formatINR(cat.total)}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {totalSpend > 0 ? ((cat.total / totalSpend) * 100).toFixed(1) : 0}%
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {cat.count}
                  </td>
                  <td className="py-3 px-4 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {formatINR(cat.total / cat.count)}
                  </td>
                </tr>

                <AnimatePresence>
                  {expandedCats.has(cat.category) && (
                    <motion.tr
                      key={`${cat.category}-subs`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td colSpan={5} className="p-0">
                        {Object.entries(cat.subs).map(([sub, subData]) => (
                          <Fragment key={sub}>
                            <div
                              className="flex items-center justify-between px-8 py-2 cursor-pointer"
                              style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.02)' }}
                              onClick={() => toggleSub(`${cat.category}-${sub}`)}
                            >
                              <div className="flex items-center gap-2">
                                {expandedSubs.has(`${cat.category}-${sub}`)
                                  ? <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
                                  : <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} />
                                }
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</span>
                              </div>
                              <div className="flex items-center gap-6 pr-4">
                                <span className="text-xs" style={{ color: 'var(--color-text)' }}>{formatINR(subData.total)}</span>
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{subData.count} txns</span>
                              </div>
                            </div>

                            <AnimatePresence>
                              {expandedSubs.has(`${cat.category}-${sub}`) && (
                                <motion.div
                                  key={`${cat.category}-${sub}-txns`}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                >
                                  <table className="w-full">
                                    <thead>
                                      <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--color-border)' }}>
                                        <th className="pl-12 py-1.5 text-left text-xs" style={{ color: 'var(--color-text-muted)' }}>Date</th>
                                        <th className="py-1.5 text-left text-xs" style={{ color: 'var(--color-text-muted)' }}>Merchant</th>
                                        <th className="py-1.5 text-right text-xs pr-3" style={{ color: 'var(--color-text-muted)' }}>Amount</th>
                                        <th className="py-1.5 text-left text-xs" style={{ color: 'var(--color-text-muted)' }}>Category</th>
                                        <th className="py-1.5 text-left text-xs pr-3" style={{ color: 'var(--color-text-muted)' }}>Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {subData.txns.map((t) => (
                                        <TxnRow key={t.id} txn={t} statementId={t.statementId} />
                                      ))}
                                    </tbody>
                                  </table>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Fragment>
                        ))}
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </Fragment>
            ))}

            {grouped.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  No transactions match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
