'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'
import type { SavingsSummary, CCSummary } from '@/types'

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

const INSIGHT_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  subscription: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  icon: '🔄' },
  anomaly:      { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  icon: '🚨' },
  trend:        { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: '⚡' },
  savings_tip:  { border: '#2563EB', bg: 'rgba(37,99,235,0.08)',   icon: '💡' },
  cc_health:    { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '✅' },
}

function SvgDonut({
  data,
  total,
}: {
  data: { name: string; value: number; color: string; pct: string }[]
  total: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const size = 180
  const cx = size / 2
  const cy = size / 2
  const outerR = 74
  const innerR = 48
  const gap = 0.02

  let angle = -Math.PI / 2
  const slices = data.map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI
    const start = angle + gap
    const end = angle + sweep - gap
    angle += sweep
    return { ...d, start, end, sweep }
  })

  const slicePath = (s: (typeof slices)[0], expand: boolean) => {
    const ro = expand ? outerR + 5 : outerR
    const ri = innerR
    const x1o = cx + ro * Math.cos(s.start)
    const y1o = cy + ro * Math.sin(s.start)
    const x2o = cx + ro * Math.cos(s.end)
    const y2o = cy + ro * Math.sin(s.end)
    const x1i = cx + ri * Math.cos(s.end)
    const y1i = cy + ri * Math.sin(s.end)
    const x2i = cx + ri * Math.cos(s.start)
    const y2i = cy + ri * Math.sin(s.start)
    const large = s.sweep - 2 * gap > Math.PI ? 1 : 0
    return `M${x1o},${y1o} A${ro},${ro} 0 ${large},1 ${x2o},${y2o} L${x1i},${y1i} A${ri},${ri} 0 ${large},0 ${x2i},${y2i} Z`
  }

  const hoveredSlice = slices.find((s) => s.name === hovered)

  return (
    <svg width={size} height={size} style={{ overflow: 'visible' }}>
      {slices.map((s) => (
        <path
          key={s.name}
          d={slicePath(s, hovered === s.name)}
          fill={s.color}
          opacity={hovered && hovered !== s.name ? 0.35 : 1}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={() => setHovered(s.name)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}
      {hoveredSlice ? (
        <>
          <text x={cx} y={cy - 10} textAnchor="middle" fontSize="9" fill="#6B7280">
            {hoveredSlice.name}
          </text>
          <text
            x={cx}
            y={cy + 7}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#0F172A"
            fontFamily="'DM Sans', sans-serif"
          >
            {formatINR(hoveredSlice.value, true)}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle" fontSize="9" fill="#6B7280">
            {hoveredSlice.pct}%
          </text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fill="#6B7280">
            Total spend
          </text>
          <text
            x={cx}
            y={cy + 13}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#0F172A"
            fontFamily="'DM Sans', sans-serif"
          >
            {formatINR(total, true)}
          </text>
        </>
      )}
    </svg>
  )
}

export default function OverviewTab() {
  const { state } = useAppState()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const months = useMemo(
    () =>
      [
        ...new Set(
          state.parsed_statements.map(
            (s) => `${s.statement_year}-${String(s.statement_month).padStart(2, '0')}`
          )
        ),
      ].sort(),
    [state.parsed_statements]
  )

  const allDates = useMemo(
    () =>
      state.parsed_statements
        .flatMap((s) => [s.period_start, s.period_end])
        .filter(Boolean)
        .sort(),
    [state.parsed_statements]
  )

  const periodLabel = useMemo(() => {
    if (allDates.length === 0) return ''
    const start = new Date(allDates[0])
    const end = new Date(allDates[allDates.length - 1])
    const fmt = (d: Date, short = false) =>
      d.toLocaleDateString('en-IN', { month: short ? 'short' : 'long', year: 'numeric' })
    return fmt(start) === fmt(end) ? fmt(start) : `${fmt(start, true)} – ${fmt(end)}`
  }, [allDates])

  const filteredStmts = useMemo(
    () =>
      state.parsed_statements.filter(
        (s) =>
          !selectedMonth ||
          `${s.statement_year}-${String(s.statement_month).padStart(2, '0')}` === selectedMonth
      ),
    [state.parsed_statements, selectedMonth]
  )

  const filteredTxns = useMemo(
    () =>
      filteredStmts
        .flatMap((s) => s.transactions)
        .filter((t) => !t.is_cc_bill_payment && t.txn_type === 'debit'),
    [filteredStmts]
  )

  const totalSpend = filteredTxns.reduce((s, t) => s + t.amount, 0)
  const largestTxn = filteredTxns.reduce((m, t) => Math.max(m, t.amount), 0)
  const totalTxnCount = state.parsed_statements.reduce(
    (s, stmt) => s + stmt.transactions.filter((t) => !t.is_cc_bill_payment && t.txn_type === 'debit').length,
    0
  )

  const avgDaily = useMemo(() => {
    const dates = filteredTxns.map((t) => t.txn_date).filter(Boolean).sort()
    if (dates.length === 0) return 0
    const span = Math.max(
      1,
      Math.ceil((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000) + 1
    )
    return totalSpend / span
  }, [filteredTxns, totalSpend])

  const netSaved = useMemo(() => {
    let income = 0,
      spend = 0
    for (const stmt of filteredStmts) {
      const s = stmt.summary as SavingsSummary & CCSummary
      if (stmt.account_type === 'savings') {
        income += s.total_credits ?? 0
        const bills = stmt.transactions
          .filter((t) => t.is_cc_bill_payment)
          .reduce((sum, t) => sum + t.amount, 0)
        spend += (s.total_debits ?? 0) - bills
      }
    }
    return income - spend
  }, [filteredStmts])

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of filteredTxns) {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        color: CATEGORY_COLORS[name] ?? '#6b7280',
        pct: totalSpend > 0 ? ((value / totalSpend) * 100).toFixed(1) : '0',
      }))
  }, [filteredTxns, totalSpend])

  const topMerchants = useMemo(() => {
    const map: Record<string, { amount: number; category: string }> = {}
    for (const t of filteredTxns) {
      const key = t.merchant_name || t.description
      if (!map[key]) map[key] = { amount: 0, category: t.category }
      map[key].amount += t.amount
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 8)
  }, [filteredTxns])

  const maxMerchantAmt = topMerchants[0]?.[1]?.amount ?? 1
  const activeInsights = state.insights.filter((i) => !i.dismissed).slice(0, 6)

  const hasSavings = filteredStmts.some((s) => s.account_type === 'savings')

  // Largest txn merchant name for sub-text
  const largestTxnMerchant = useMemo(() => {
    if (filteredTxns.length === 0) return ''
    const t = filteredTxns.reduce((m, c) => (c.amount > m.amount ? c : m), filteredTxns[0])
    return t.merchant_name || t.description || ''
  }, [filteredTxns])

  // Month-over-month comparison for Total Spend (when multiple months exist)
  const prevMonthSpend = useMemo(() => {
    if (!selectedMonth || months.length < 2) return null
    const idx = months.indexOf(selectedMonth)
    if (idx <= 0) return null
    const prevMonth = months[idx - 1]
    const prevTxns = state.parsed_statements
      .filter(
        (s) =>
          `${s.statement_year}-${String(s.statement_month).padStart(2, '0')}` === prevMonth
      )
      .flatMap((s) => s.transactions)
      .filter((t) => !t.is_cc_bill_payment && t.txn_type === 'debit')
    return prevTxns.reduce((sum, t) => sum + t.amount, 0)
  }, [selectedMonth, months, state.parsed_statements])

  const spendDeltaPct = prevMonthSpend != null && prevMonthSpend > 0
    ? ((totalSpend - prevMonthSpend) / prevMonthSpend) * 100
    : null

  // Day span for avg daily sub-text
  const daySpan = useMemo(() => {
    const dates = filteredTxns.map((t) => t.txn_date).filter(Boolean).sort()
    if (dates.length < 2) return null
    return (
      Math.ceil(
        (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000
      ) + 1
    )
  }, [filteredTxns])

  const topCategory = categoryData[0]?.name ?? ''

  const stats: { label: string; value: string; color: string; sub?: string; subColor?: string }[] = [
    {
      label: 'TOTAL SPEND',
      value: formatINR(totalSpend),
      color: 'var(--color-text)',
      sub: spendDeltaPct != null
        ? `${spendDeltaPct >= 0 ? '+' : ''}${spendDeltaPct.toFixed(1)}% vs prev month`
        : topCategory ? `Top: ${topCategory}` : undefined,
      subColor: spendDeltaPct != null
        ? spendDeltaPct > 0 ? 'var(--color-red)' : 'var(--color-green)'
        : 'var(--color-text-muted)',
    },
    {
      label: 'AVG. DAILY',
      value: formatINR(Math.round(avgDaily)),
      color: 'var(--color-text)',
      sub: daySpan != null ? `over ${daySpan} days` : undefined,
      subColor: 'var(--color-text-muted)',
    },
    {
      label: 'LARGEST TXN',
      value: formatINR(largestTxn),
      color: 'var(--color-text)',
      sub: largestTxnMerchant || undefined,
      subColor: 'var(--color-text-muted)',
    },
    hasSavings
      ? {
          label: 'NET SAVED',
          value: (netSaved >= 0 ? '+' : '−') + formatINR(Math.abs(netSaved)),
          color: netSaved >= 0 ? 'var(--color-green)' : 'var(--color-red)',
          sub: netSaved >= 0 ? '↑ Positive cash flow' : '↓ Spending > income',
          subColor: netSaved >= 0 ? 'var(--color-green)' : 'var(--color-red)',
        }
      : {
          label: 'TRANSACTIONS',
          value: String(filteredTxns.length),
          color: 'var(--color-text)',
          sub: `across ${filteredStmts.length} statement${filteredStmts.length !== 1 ? 's' : ''}`,
          subColor: 'var(--color-text-muted)',
        },
  ]

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Period header + month chips */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-extrabold"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
          >
            {periodLabel}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {totalTxnCount} transactions · {state.parsed_statements.length} statement
            {state.parsed_statements.length !== 1 ? 's' : ''}
          </p>
        </div>

        {months.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
              style={{
                background: selectedMonth === null ? 'var(--color-accent)' : 'transparent',
                color: selectedMonth === null ? '#fff' : 'var(--color-text-muted)',
                borderColor: selectedMonth === null ? 'var(--color-accent)' : 'var(--color-border)',
              }}
            >
              All
            </button>
            {months.map((m) => {
              const d = new Date(`${m}-01`)
              const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
              const active = selectedMonth === m
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(active ? null : m)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                  style={{
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-muted)',
                    borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 4 Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className="rounded-2xl border p-4"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <p
              className="text-xs font-semibold tracking-wider mb-2"
              style={{ color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}
            >
              {stat.label}
            </p>
            <p
              className="text-[30px] font-extrabold leading-none mb-1.5"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.02em', color: stat.color, fontWeight: 800 }}
            >
              {stat.value}
            </p>
            {stat.sub && (
              <p className="text-xs truncate" style={{ color: stat.subColor ?? 'var(--color-text-muted)' }}>
                {stat.sub}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* 3-panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: By Category */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            By Category
          </h3>
          {categoryData.length > 0 ? (
            <>
              <div className="flex justify-center mb-5">
                <SvgDonut data={categoryData} total={totalSpend} />
              </div>
              <div className="space-y-2.5">
                {categoryData.slice(0, 7).map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: c.color }}
                    />
                    <span
                      className="text-xs flex-1 min-w-0 truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {c.name}
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      {c.pct}%
                    </span>
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}
                    >
                      {formatINR(c.value, true)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              No spending data
            </p>
          )}
        </motion.div>

        {/* Panel 2: AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            AI Insights
          </h3>
          {activeInsights.length > 0 ? (
            <div className="space-y-3">
              {activeInsights.map((insight) => {
                const style = INSIGHT_STYLES[insight.insight_type] ?? INSIGHT_STYLES.savings_tip
                return (
                  <div
                    key={insight.id}
                    className="rounded-xl p-3"
                    style={{
                      background: style.bg,
                      borderLeft: `3px solid ${style.border}`,
                      border: `1px solid var(--color-border)`,
                      borderLeftWidth: 3,
                      borderLeftColor: style.border,
                    }}
                  >
                    <div className="flex gap-2.5">
                      <span className="text-sm leading-none mt-0.5 flex-shrink-0">{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-semibold mb-0.5 leading-snug"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {insight.title}
                        </p>
                        <p
                          className="text-xs leading-relaxed"
                          style={{
                            color: 'var(--color-text-muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {insight.body}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              No insights available
            </p>
          )}
        </motion.div>

        {/* Panel 3: Top Merchants */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border p-5"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Top Merchants
          </h3>
          {topMerchants.length > 0 ? (
            <div className="space-y-3">
              {topMerchants.map(([name, data]) => (
                <div key={name} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: `${CATEGORY_COLORS[data.category] ?? '#6b7280'}18`,
                      color: CATEGORY_COLORS[data.category] ?? '#6b7280',
                    }}
                  >
                    {name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {name}
                    </p>
                    <p className="text-xs truncate mb-1" style={{ color: 'var(--color-text-muted)' }}>
                      {data.category}
                    </p>
                    <div
                      className="h-1 rounded-full overflow-hidden"
                      style={{ background: 'var(--color-border)' }}
                    >
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${(data.amount / maxMerchantAmt) * 100}%`,
                          background: CATEGORY_COLORS[data.category] ?? 'var(--color-accent)',
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold tabular-nums flex-shrink-0"
                    style={{ fontFamily: "'DM Sans', sans-serif", color: 'var(--color-text)' }}
                  >
                    {formatINR(data.amount, true)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              No merchant data
            </p>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
