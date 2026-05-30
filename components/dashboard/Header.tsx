'use client'

import { Download, Upload, RotateCcw } from 'lucide-react'
import { useAppState } from '@/context/AppContext'
import { exportPDF } from '@/lib/pdf-export'

export default function Header() {
  const { state, dispatch } = useAppState()

  const handleDownload = async () => {
    await exportPDF(state.parsed_statements, state.insights)
  }

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      <span
        className="text-2xl font-bold italic"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent)' }}
      >
        SpendDash
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all hover:opacity-80 active:scale-95"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <Upload size={14} />
          <span className="hidden sm:inline">New Analysis</span>
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Download size={14} />
          <span className="hidden sm:inline">Download PDF</span>
        </button>
      </div>
    </header>
  )
}
