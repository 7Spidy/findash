'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR, formatShortDate } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  'Transport':     '#3b82f6',
  'Shopping':      '#a855f7',
  'Entertainment': '#ec4899',
  'Subscriptions': '#6366f1',
  'Utilities':     '#eab308',
  'Travel':        '#0EA5E9',
  'Investments':   '#22c55e',
  'Health':        '#ef4444',
  'Others':        '#6b7280',
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Food & Dining': '🍽️',
  'Transport':     '🚗',
  'Shopping':      '🛍️',
  'Entertainment': '🎬',
  'Subscriptions': '📦',
  'Utilities':     '⚡',
  'Travel':        '✈️',
  'Investments':   '📈',
  'Health':        '❤️',
  'Others':        '📁',
}

const ALL_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Subscriptions', 'Utilities', 'Travel', 'Investments', 'Health', 'Others',
]

type SortKey = 'txn_date' | 'merchant_name' | 'category' | 'amount'
type SortDir = 'asc' | 'desc'

interface TransactionViewProps {
  filterCategory?: string | null
  filterMonth?: string | null
  onFilterClear?: () => void
}

export default function TransactionView({ filterCategory: externalCat, filterMonth, onFilterClear }: TransactionViewProps) {
  const { state } = useAppState()
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string | null>(externalCat ?? null)
  const [sortKey, setSortKey] = useState<SortKey>('txn_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Sync external filterCategory prop
  const effectiveCat = externalCat ?? activeCat

  const allTxns = useMemo(
    () =>
      state.parsed_statements.flatMap((s) =>
        s.transactions
          .filter((t) => !t.is_cc_bill_payment)
          .map((t) => ({ ...t, statementId: s.id, bank: s.bank }))
      ),
    [state.parsed_statements]
  )

  // Categories that actually have transactions
  const presentCategories = useMemo(
    () => ALL_CATEGORIES.filter((c) => allTxns.some((t) => t.category === c && t.txn_type === 'debit')),
    [allTxns]
  )

  const filtered = useMemo(() => {
    return allTxns.filter((t) => {
      if (effectiveCat && t.category !== effectiveCat) return false
      if (filterMonth && t.txn_date?.slice(0, 7) !== filterMonth) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          (t.merchant_name || t.description).toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allTxns, effectiveCat, filterMonth, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'txn_date':
          cmp = (a.txn_date ?? '').localeCompare(b.txn_date ?? '')
          break
        case 'merchant_name':
          cmp = (a.merchant_name || a.description).localeCompare(b.merchant_name || b.description)
          break
        case 'category':
          cmp = a.category.localeCompare(b.category)
          break
        case 'amount':
          cmp = a.amount - b.amount
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'asc')
    }
  }

  const toggleCat = (cat: string) => {
    if (externalCat !== undefined && externalCat !== null) {
      onFilterClear?.()
    } else {
      setActiveCat((prev) => (prev === cat ? null : cat))
    }
  }

  const clearFilters = () => {
    setActiveCat(null)
    onFilterClear?.()
  }

  const totalShown = sorted.reduce((s, t) => s + (t.txn_type === 'debit' ? t.amount : 0), 0)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={11} />
      : <ChevronDown size={11} />
  }

  return (
    <motion.div
      key="transactions"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={clearFilters}
          className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
          style={{
            background: !effectiveCat && !filterMonth ? 'var(--color-accent)' : 'transparent',
            color: !effectiveCat && !filterMonth ? '#fff' : 'var(--color-text-muted)',
            borderColor: !effectiveCat && !filterMonth ? 'var(--color-accent)' : 'var(--color-border)',
          }}
        >
          All
        </button>
        {presentCategories.map((cat) => {
          const active = effectiveCat === cat
          const color = CATEGORY_COLORS[cat] ?? '#6b7280'
          return (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all flex items-center gap-1.5"
              style={{
                background: active ? `${color}18` : 'transparent',
                color: active ? color : 'var(--color-text-muted)',
                borderColor: active ? color : 'var(--color-border)',
              }}
            >
              <span>{CATEGORY_EMOJI[cat]}</span>
              <span>{cat}</span>
            </button>
          )
        })}
        {filterMonth && (
          <button
            onClick={onFilterClear}
            className="text-xs px-3 py-1.5 rounded-full border font-medium flex items-center gap-1.5 transition-all"
            style={{
              background: 'rgba(123,63,0,0.10)',
              color: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
            }}
          >
            {filterMonth} <X size={10} />
          </button>
        )}
      </div>

      {/* Search + summary bar */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b gap-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2 flex-1">
            <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions…"
              className="text-sm bg-transparent outline-none flex-1"
              style={{ color: 'var(--color-text)' }}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X size={13} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            )}
          </div>
          <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            {sorted.length} txns{totalShown > 0 ? ` · ${formatINR(totalShown, true)}` : ''}
          </span>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  background: 'var(--color-surface-2)',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                {(
                  [
                    { key: 'txn_date', label: 'Date', align: 'left', cls: 'py-3 px-5' },
                    { key: 'merchant_name', label: 'Merchant', align: 'left', cls: 'py-3 px-4' },
                    { key: 'category', label: 'Category', align: 'left', cls: 'py-3 px-4' },
                    { key: 'amount', label: 'Amount', align: 'right', cls: 'py-3 px-5' },
                  ] as { key: SortKey; label: string; align: string; cls: string }[]
                ).map(({ key, label, align, cls }) => (
                  <th
                    key={key}
                    className={`${cls} text-xs font-medium select-none cursor-pointer`}
                    style={{ color: sortKey === key ? 'var(--color-accent)' : 'var(--color-text-muted)', textAlign: align as 'left' | 'right' }}
                    onClick={() => handleSort(key)}
                  >
                    <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((txn, idx) => {
                const catColor = CATEGORY_COLORS[txn.category] ?? '#6b7280'
                return (
                  <tr
                    key={txn.id}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        idx < sorted.length - 1 ? '1px solid var(--color-border)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background =
                        'var(--color-surface-2)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                    }}
                  >
                    <td
                      className="py-3 px-5 text-xs whitespace-nowrap"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {formatShortDate(txn.txn_date)}
                    </td>
                    <td className="py-3 px-4 text-sm max-w-xs">
                      <span className="truncate block" style={{ color: 'var(--color-text)' }}>
                        {txn.merchant_name || txn.description}
                      </span>
                      {txn.bank && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {txn.bank}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${catColor}18`,
                          color: catColor,
                        }}
                      >
                        {CATEGORY_EMOJI[txn.category] ?? ''} {txn.category}
                      </span>
                    </td>
                    <td
                      className="py-3 px-5 text-right text-sm font-semibold tabular-nums whitespace-nowrap"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        color:
                          txn.txn_type === 'credit' ? 'var(--color-green)' : 'var(--color-text)',
                      }}
                    >
                      {txn.txn_type === 'credit' ? '+' : ''}
                      {formatINR(txn.amount)}
                    </td>
                  </tr>
                )
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {sorted.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No transactions match your filters.
            </p>
          ) : (
            sorted.map((txn) => {
              const catColor = CATEGORY_COLORS[txn.category] ?? '#6b7280'
              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: `${catColor}18` }}
                  >
                    {CATEGORY_EMOJI[txn.category] ?? '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {txn.merchant_name || txn.description}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatShortDate(txn.txn_date)} · {txn.category}
                    </p>
                  </div>
                  <span
                    className="text-sm font-semibold tabular-nums flex-shrink-0"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      color: txn.txn_type === 'credit' ? 'var(--color-green)' : 'var(--color-text)',
                    }}
                  >
                    {txn.txn_type === 'credit' ? '+' : '−'}
                    {formatINR(txn.amount, true)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </motion.div>
  )
}
