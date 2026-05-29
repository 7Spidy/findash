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

type Tab = 'overview' | 'transactions' | 'cards' | 'insights'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'cards',        label: 'Cards' },
  { id: 'insights',     label: 'AI Insights' },
]

const ANALYSIS_STEPS = [
  'Reading your statements…',
  'Categorising transactions…',
  'Generating AI insights…',
  'Building your dashboard…',
]

function AnalysingScreen() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm text-center"
      >
        <p
          className="text-2xl font-bold italic mb-2"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
        >
          Analysing your statement
        </p>
        <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
          This usually takes 15–30 seconds
        </p>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden mb-8"
          style={{ background: 'var(--color-border)' }}
        >
          <div
            className="h-full rounded-full progress-bar-fill"
            style={{ background: 'var(--color-accent)' }}
          />
        </div>

        {/* Step indicators */}
        <div className="space-y-3">
          {ANALYSIS_STEPS.map((step, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 2, duration: 0.4 }}
              className="flex items-center gap-3"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                initial={{ background: 'var(--color-border)' }}
                animate={{ background: 'var(--color-accent)' }}
                transition={{ delay: i * 2, duration: 0.3 }}
              />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {step}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default function Home() {
  const { state } = useAppState()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMonth, setFilterMonth] = useState<string | null>(null)

  const status = state.analysis_status

  return (
    <AnimatePresence mode="wait">
      {status === 'idle' || status === 'error' ? (
        <motion.div
          key="upload"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <UploadZone />
        </motion.div>
      ) : status === 'analysing' ? (
        <motion.div
          key="analysing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AnalysingScreen />
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
          <Header />

          {/* Tab bar */}
          <div
            className="sticky top-[65px] z-30 border-b"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative px-4 py-3.5 text-sm font-medium transition-colors"
                  style={{
                    color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <NetFlowCard />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CategoryDonut onCategorySelect={setFilterCategory} />
                    <MonthlyBarChart onMonthSelect={setFilterMonth} />
                  </div>
                  <StatementExplorer />
                </motion.div>
              )}

              {activeTab === 'transactions' && (
                <motion.div
                  key="transactions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <CategoryTable
                    filterCategory={filterCategory}
                    filterMonth={filterMonth}
                    onFilterClear={() => { setFilterCategory(null); setFilterMonth(null) }}
                  />
                </motion.div>
              )}

              {activeTab === 'cards' && (
                <motion.div
                  key="cards"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <CCHealthCard />
                  <AccountBalanceCard />
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div
                  key="insights"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <InsightCard />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          <footer className="py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Made with ❤️ by Avi
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
