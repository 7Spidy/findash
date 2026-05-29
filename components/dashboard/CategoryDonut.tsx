'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'

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

interface CategoryDonutProps {
  onCategorySelect?: (category: string | null) => void
}

export default function CategoryDonut({ onCategorySelect }: CategoryDonutProps) {
  const { state } = useAppState()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categoryMap: Record<string, number> = {}
  for (const stmt of state.parsed_statements) {
    for (const txn of stmt.transactions) {
      if (txn.is_cc_bill_payment || txn.txn_type === 'credit') continue
      categoryMap[txn.category] = (categoryMap[txn.category] ?? 0) + txn.amount
    }
  }

  const totalSpend = Object.values(categoryMap).reduce((a, b) => a + b, 0)
  const data = Object.entries(categoryMap)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      pct: totalSpend > 0 ? ((value / totalSpend) * 100).toFixed(1) : '0',
    }))

  const handleClick = (entry: { name: string }) => {
    const next = activeCategory === entry.name ? null : entry.name
    setActiveCategory(next)
    onCategorySelect?.(next)
  }

  return (
    <motion.div
      id="category-donut-chart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border p-5"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <h3 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Spend by Category
      </h3>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              onClick={handleClick}
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={CATEGORY_COLORS[entry.name] ?? '#6b7280'}
                  opacity={activeCategory === null || activeCategory === entry.name ? 1 : 0.4}
                  stroke="transparent"
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
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
              formatter={(value: number, name: string) => [
                `${formatINR(value)} (${data.find((d) => d.name === name)?.pct}%)`,
                name,
              ]}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {activeCategory && (
        <div className="mt-2 text-center">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Filtered to{' '}
            <strong style={{ color: 'var(--color-text)' }}>{activeCategory}</strong>
            {' '}· Click again to clear
          </span>
        </div>
      )}
    </motion.div>
  )
}
