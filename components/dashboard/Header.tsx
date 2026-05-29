'use client'

import { Moon, Sun, Download, RotateCcw } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { exportPDF } from '@/lib/pdf-export'

interface HeaderProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

export default function Header({ theme, onThemeToggle }: HeaderProps) {
  const { state, dispatch } = useAppState()

  const allDates = state.parsed_statements
    .flatMap((s) => [s.period_start, s.period_end])
    .filter(Boolean)
    .sort()

  const getPeriodLabel = () => {
    if (allDates.length === 0) return ''
    const start = new Date(allDates[0])
    const end = new Date(allDates[allDates.length - 1])
    const startStr = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const endStr = end.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    return startStr === endStr ? startStr : `${start.toLocaleDateString('en-IN', { month: 'short' })} – ${endStr}`
  }

  const handleDownload = async () => {
    await exportPDF(state.parsed_statements, state.insights)
  }

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center gap-4">
        <span
          className="text-2xl font-bold"
          style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-accent)' }}
        >
          Spend Dash
        </span>
        {getPeriodLabel() && (
          <span className="text-sm hidden sm:block" style={{ color: 'var(--color-text-muted)' }}>
            {getPeriodLabel()}
          </span>
        )}
        <span
          className="text-xs px-2.5 py-1 rounded-full border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          {state.parsed_statements.length} statement{state.parsed_statements.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Download size={15} />
          <span className="hidden sm:inline">Download Report</span>
        </button>

        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <RotateCcw size={15} />
          <span className="hidden sm:inline">Start Over</span>
        </button>

        <button
          onClick={onThemeToggle}
          className="p-2 rounded-full transition-colors"
          style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
