'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { formatINR } from '@/lib/utils'
import type { AIInsight } from '@/types'

const INSIGHT_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  subscription: { border: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  icon: '🔄' },
  anomaly:      { border: '#f97316', bg: 'rgba(249,115,22,0.06)',  icon: '🚨' },
  trend:        { border: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  icon: '⚡' },
  savings_tip:  { border: '#2563EB', bg: 'rgba(37,99,235,0.06)',  icon: '💡' },
  cc_health:    { border: '#22c55e', bg: 'rgba(34,197,94,0.06)',   icon: '✅' },
}

const SEVERITY_COLORS = {
  info:     'var(--color-text-muted)',
  warning:  'var(--color-amber)',
  critical: 'var(--color-red)',
}

function SingleInsightCard({ insight }: { insight: AIInsight }) {
  const { dispatch } = useAppState()
  const style = INSIGHT_STYLES[insight.insight_type] ?? INSIGHT_STYLES.savings_tip

  return (
    <AnimatePresence>
      {!insight.dismissed && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border-l-4 p-4 relative"
          style={{
            background: style.bg,
            borderLeftColor: style.border,
            borderTop: '1px solid var(--color-border)',
            borderRight: '1px solid var(--color-border)',
            borderBottom: '1px solid var(--color-border)',
          }}
          whileHover={{ translateY: -2 }}
        >
          <button
            onClick={() => dispatch({ type: 'DISMISS_INSIGHT', payload: insight.id })}
            className="absolute top-3 right-3 p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={13} />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <span className="text-xl leading-none mt-0.5">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  {insight.title}
                </p>
                <span
                  className="text-xs px-1.5 py-0.5 rounded capitalize"
                  style={{
                    color: SEVERITY_COLORS[insight.severity],
                    background: `${SEVERITY_COLORS[insight.severity]}15`,
                  }}
                >
                  {insight.severity}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {insight.body}
              </p>
              {insight.related_amount > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {insight.insight_type === 'subscription' && (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-amber)' }}>
                        {formatINR(insight.related_amount)}/mo
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.08)', color: 'var(--color-amber)' }}>
                        {formatINR(insight.related_amount * 12)}/yr
                      </span>
                    </>
                  )}
                  {insight.related_merchant && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
                      {insight.related_merchant}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function InsightCard() {
  const { state } = useAppState()
  const activeInsights = state.insights.filter((i) => !i.dismissed)

  if (activeInsights.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
        <p className="text-sm">All insights dismissed.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {state.insights.map((insight) => (
        <SingleInsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  )
}
