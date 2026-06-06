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

const MONEY_QUOTES: string[] = [
  "What you earn is just the start; what you save reveals the art.",
  "A penny saved today keeps the creditors away.",
  "Save a slice of every pie, and wealthy you shall be by-and-by.",
  "Count your coins before they fly; what's spent is gone, what's saved will multiply.",
  "Every rupee saved tonight works for you by morning light.",
  "He who saves in sunny days weathers every stormy phase.",
  "Small savings, often made, build the fortune that won't fade.",
  "The frugal man grows richer than the lavish, if he can.",
  "Save not what is left after spending, but spend what is left after saving.",
  "Fill the purse before the plate, and your future won't be late.",
  "Spend with intent, and wealth is lent back to you by time well spent.",
  "Money made in haste is often money laid to waste.",
  "He who spends first will save last — if at all.",
  "Don't pay for today with tomorrow's peace.",
  "Every impulse buy is a quiet tax on your future self.",
  "Debt is a weight that grows by night; savings are a morning light.",
  "A loan in hand may feel like gold, but interest makes the price unfold.",
  "He who avoids debt avoids the chains that follow.",
  "A rupee of debt costs more than a rupee of savings earns.",
  "Borrow with a plan, or not at all; debt without purpose makes you fall.",
  "The coin you keep will grow and leap; compound is a secret deep.",
  "Time in the market beats timing the market.",
  "The market dips, the market soars; patience always opens doors.",
  "Markets test your faith before they reward your patience.",
  "Gold is found by those who learn to let their savings slowly turn.",
  "Invest in boring things; excitement is reserved for casinos.",
  "The market rewards patience far more than it rewards genius.",
  "Opportunity knocks once; compound interest knocks daily.",
  "Plant your money like a seed; tend it well to meet your need.",
  "A patient investor's garden grows when others fear to sow.",
  "A budget is a map to where you want to be; spend without one and you'll never see.",
  "He who budgets never grudges.",
  "Track every rupee, for in tracking lies the mastery.",
  "A planned expense is a managed one; an impulse is a regret in waiting.",
  "Know where your money sleeps, lest it wander into someone else's dream.",
  "A leak in your wallet can sink the ship of wealth.",
  "Don't let your lifestyle inflate faster than your income dictates.",
  "Know your expenses like you know your friends — intimately.",
  "A financial goal without a plan is just a wish in the wind.",
  "The humble spender often outlasts the lavish earner.",
  "Rich is not who earns the most, but who wastes the least to boast.",
  "Wealth is less about the earning and more about the learning.",
  "Money is a river — direct its flow, or it will carve its own.",
  "Contentment is the greatest wealth; desire, the deepest poverty.",
  "The wealthiest person is not who has the most, but who needs the least.",
  "Security comes not from earning more, but from needing less.",
  "The greatest luxury is not needing luxury.",
  "Financial peace is not about the amount, but the arrangement.",
  "Wealth whispers; debt shouts.",
  "Comfort with less is a kind of abundance.",
  "He who understands compound interest earns it; he who doesn't pays it.",
  "Good money habits compound like interest — silently, then suddenly.",
  "Invest in your future self; she'll thank you most generously.",
  "Every rupee managed wisely is worth ten earned carelessly.",
  "A rupee today that compounds away is worth far more than what you say.",
  "Money unspent is freedom unspent.",
  "The price of financial freedom is paid in small daily choices.",
  "Financial freedom is bought one decision at a time.",
  "One who controls their spending controls their destiny.",
  "Pay yourself first; the rest will sort itself.",
  "The richest version of you is built by thousands of small choices.",
  "The best time to save was yesterday; the next best time is today.",
  "Time and money, both are rare; invest them both with greatest care.",
  "Wealth is not rushed; it is tended through the years unhushed.",
  "Slow money made honestly outlasts fast money made rashly.",
  "Start investing early, stay investing long — that is the investor's song.",
  "Buy what depreciates with care; invest in what appreciates with flair.",
  "Your income matters far less than your net position.",
  "Diversify your holdings like you diversify your meals.",
  "Avoid spending to impress those who spend to impress you.",
  "The habit of saving is itself an education worth having.",
  "Your spending habits are your autobiography written in numbers.",
  "The scoreboard of wealth is printed on statements, not social feeds.",
  "Build systems, not wishes; wealth follows process, not just riches.",
  "Financial clarity begins where denial ends.",
  "Every subscription reviewed is a choice actively renewed.",
  "Invest in knowledge first; it quenches every financial thirst.",
  "Fortune favours the one who plans before the rain.",
  "The rich invest time; the poor spend time. Both spend money.",
  "Frugality is not poverty; it is wisdom dressed humbly.",
  "The path to wealth is paved with consistent, boring decisions.",
  "Not all who wander in markets are lost — some are simply invested.",
  "Simplicity in spending is sophistication in planning.",
  "Financial health is not a destination, it's a daily direction.",
  "Money is a tool; wealth is the mindset that shapes how it's used.",
  "The surest path to wealth passes through discipline's gate.",
  "A pot saved drop by drop is the one that never stops.",
  "He who counts what goes out never runs out.",
  "In markets wild and markets tame, consistency will win the game.",
  "Don't count the coins you've spent with pride; count the ones working inside.",
  "Your net worth is the story your numbers tell of priorities well.",
  "Financial independence is the quiet revolution of the disciplined.",
  "Wealth is the residue of habit, not of luck.",
  "The best returns are earned in turns of patience and of discipline.",
  "Every statement reviewed is a step toward the life you've pursued.",
  "Know your numbers, know yourself; financial health is your true wealth.",
  "The numbers don't lie, but they do whisper — learn to listen.",
  "A clear view of spending is the beginning of your ascending.",
  "What gets measured gets managed, and managed wealth expands.",
  "Spend less than you earn, invest the rest, and time will do the rest.",
]

function AnalysingScreen() {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * MONEY_QUOTES.length))
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

  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx((prev) => {
        let next = Math.floor(Math.random() * MONEY_QUOTES.length)
        while (next === prev) next = Math.floor(Math.random() * MONEY_QUOTES.length)
        return next
      })
    }, 10000)
    return () => clearInterval(id)
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
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', textAlign: 'center', marginBottom: 28 }}>
          {ANALYSIS_STEPS[stepIdx]}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={quoteIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              padding: '18px 22px',
              background: '#FFFFFF',
              border: '1px solid #E6E0D4',
              borderRadius: 12,
              marginBottom: 20,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <p
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: 'italic',
                fontSize: 14.5,
                color: '#7B3F00',
                textAlign: 'center',
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              &ldquo;{MONEY_QUOTES[quoteIdx]}&rdquo;
            </p>
          </motion.div>
        </AnimatePresence>
        <p style={{ fontSize: 11.5, color: '#B0A898', textAlign: 'center', lineHeight: 1.7, margin: 0 }}>
          Your PDF is parsed locally in your browser.<br />
          Extracted transaction text is sent to Claude AI for analysis — nothing is stored.
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
