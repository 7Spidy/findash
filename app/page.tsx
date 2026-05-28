'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '@/context/AppContext'
import UploadZone from '@/components/upload/UploadZone'
import Header from '@/components/dashboard/Header'
import NetFlowCard from '@/components/dashboard/NetFlowCard'
import CCHealthCard from '@/components/dashboard/CCHealthCard'
import AccountBalanceCard from '@/components/dashboard/AccountBalanceCard'
import CategoryDonut from '@/components/dashboard/CategoryDonut'
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart'
import CategoryTable from '@/components/dashboard/CategoryTable'
import InsightCard from '@/components/dashboard/InsightCard'
import StatementExplorer from '@/components/dashboard/StatementExplorer'

export default function Home() {
  const { state } = useAppState()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMonth, setFilterMonth] = useState<string | null>(null)

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  const isDashboard = state.analysis_status === 'done'

  return (
    <AnimatePresence mode="wait">
      {!isDashboard ? (
        <motion.div
          key="upload"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <UploadZone theme={theme} onThemeToggle={toggleTheme} />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="min-h-screen"
          style={{ background: 'var(--color-bg)' }}
        >
          <Header theme={theme} onThemeToggle={toggleTheme} />

          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            {/* Section 1 — Hero */}
            <section>
              <NetFlowCard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <CCHealthCard />
                <AccountBalanceCard />
              </div>
            </section>

            {/* Section 2 — Spend Analytics */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Spend Analytics
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <CategoryDonut onCategorySelect={setFilterCategory} />
                <MonthlyBarChart onMonthSelect={setFilterMonth} />
              </div>
              <CategoryTable
                filterCategory={filterCategory}
                filterMonth={filterMonth}
                onFilterClear={() => { setFilterCategory(null); setFilterMonth(null) }}
              />
            </section>

            {/* Section 3 — AI Insights */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
                AI Insights
              </h2>
              <InsightCard />
            </section>

            {/* Section 4 — Statement Explorer */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Statement Explorer
              </h2>
              <StatementExplorer />
            </section>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
