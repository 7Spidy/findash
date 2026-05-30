'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Upload } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { exportPDF } from '@/lib/pdf-export'
import UploadZone from '@/components/upload/UploadZone'
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
      const pct = Math.min(((Date.now() - start) / duration) * 100, 95)
      setProgress(pct)
      setStepIdx(Math.min(Math.floor(pct / 26), 3))
      if (pct < 95) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      style={{
        width: '100vw', height: '100vh', background: '#FAF8F3',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '0 24px',
      }}
    >
      <span
        style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 700,
          fontSize: 24, color: '#0F172A', marginBottom: 52, letterSpacing: '-0.01em',
        }}
      >
        Spend<em style={{ fontStyle: 'italic' }}>Dash</em>
      </span>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div style={{ height: 3, background: '#E6E0D4', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <div
            style={{
              height: 3, width: `${progress}%`, background: '#7B3F00',
              borderRadius: 2, transition: 'width 0.08s linear',
            }}
          />
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
  const { state, dispatch } = useAppState()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterMonth, setFilterMonth] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const status = state.analysis_status

  const handleDownloadPDF = async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      await exportPDF(state.parsed_statements, state.insights)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPdfLoading(false)
    }
  }

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
          {/* ── Unified header: logo + tabs + actions in one bar ── */}
          <header
            className="sticky top-0 z-40 border-b"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
              {/* Logo */}
              <span
                className="text-xl font-bold italic flex-shrink-0"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent)' }}
              >
                SpendDash
              </span>

              {/* Tabs — inline, desktop */}
              <nav className="hidden sm:flex items-end self-stretch gap-0 flex-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative px-4 h-full text-sm font-medium transition-colors"
                    style={{
                      color:
                        activeTab === tab.id
                          ? 'var(--color-accent)'
                          : 'var(--color-text-muted)',
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
              </nav>

              {/* Spacer on mobile (tabs show below) */}
              <div className="sm:hidden flex-1" />

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => dispatch({ type: 'RESET' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all hover:opacity-80 active:scale-95"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  <Upload size={13} />
                  <span className="hidden sm:inline">New Analysis</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">
                    {pdfLoading ? 'Generating…' : 'Download PDF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile tab bar (below logo row) */}
            <div
              className="sm:hidden flex border-t overflow-x-auto"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color:
                      activeTab === tab.id
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="tab-underline-mobile"
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ background: 'var(--color-accent)' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && <OverviewTab key="overview" />}

              {activeTab === 'transactions' && (
                <TransactionView
                  key="transactions"
                  filterCategory={filterCategory}
                  filterMonth={filterMonth}
                  onFilterClear={() => {
                    setFilterCategory(null)
                    setFilterMonth(null)
                  }}
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
