'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '@/context/AppContext'
import UploadZone from '@/components/upload/UploadZone'
import Header from '@/components/dashboard/Header'
import OverviewTab from '@/components/dashboard/OverviewTab'
import TransactionView from '@/components/dashboard/TransactionView'
import CCHealthCard from '@/components/dashboard/CCHealthCard'
import AccountBalanceCard from '@/components/dashboard/AccountBalanceCard'
import InsightCard from '@/components/dashboard/InsightCard'

type Tab = 'overview' | 'transactions' | 'cards' | 'insights'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',     label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'cards',        label: 'Cards' },
  { id: 'insights',     label: 'AI Insights' },
]

const ANALYSIS_STEPS = [
  'Reading your statement…',
  'Identifying categories…',
  'Generating AI insights…',
  'Almost ready…',
]

function AnalysingScreen() {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 25000
    const tick = () => {
      const pct = Math.min((Date.now() - start) / duration * 100, 95)
      setProgress(pct)
      setStepIdx(Math.min(Math.floor(pct / 26), 3))
      if (pct < 95) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#FAF8F3',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '0 24px',
    }}>
      <span style={{
        fontFamily: "'Playfair Display', serif", fontWeight: 700,
        fontSize: 24, color: '#0F172A', marginBottom: 52, letterSpacing: '-0.01em',
      }}>
        Spend<em style={{ fontStyle: 'italic' }}>Dash</em>
      </span>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ height: 3, background: '#E6E0D4', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ height: 3, width: `${progress}%`, background: '#7B3F00', borderRadius: 2, transition: 'width 0.08s linear' }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', textAlign: 'center', marginBottom: 10 }}>
          {ANALYSIS_STEPS[stepIdx]}
        </div>
        <p style={{ fontSize: 12.5, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
          Your data is processed entirely in your browser.<br />Nothing is sent to any server.
        </p>
      </div>
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
                <OverviewTab />
              )}

              {activeTab === 'transactions' && (
                <TransactionView
                  filterCategory={filterCategory}
                  filterMonth={filterMonth}
                  onFilterClear={() => { setFilterCategory(null); setFilterMonth(null) }}
                />
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
