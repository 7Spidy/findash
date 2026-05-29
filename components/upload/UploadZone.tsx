'use client'

import { useRef, useState, useCallback } from 'react'
import { Upload, X, Check, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppState } from '@/context/AppContext'
import { extractPdfText, PasswordRequiredError } from '@/lib/pdf-extractor'
import StatementCard from './StatementCard'

interface FileEntry {
  file: File
  status: 'extracting' | 'ready' | 'password_required' | 'failed'
  pageCount?: number
  error?: string
  extractedText?: string
  passwordUsed?: boolean
}

const ACCENT_COLORS = [
  { value: '#7B3F00', label: 'Chocolate Brown' },
  { value: '#D97706', label: 'Amber' },
  { value: '#1E40AF', label: 'Blue' },
  { value: '#166534', label: 'Green' },
]

const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank', 'Axis Bank', 'Kotak', 'AMEX']

const FEATURES = [
  { icon: '🔒', title: 'Zero storage', desc: 'Parsed in your browser' },
  { icon: '⚡', title: 'Instant results', desc: 'AI insights in seconds' },
  { icon: '🤖', title: 'Claude AI', desc: 'Smart pattern analysis' },
  { icon: '🇮🇳', title: 'Indian banks', desc: 'HDFC, ICICI, SBI & more' },
]

export default function UploadZone() {
  const { state, dispatch } = useAppState()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [tweaksOpen, setTweaksOpen] = useState(true)
  const [accentColor, setAccentColor] = useState('#7B3F00')
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const applyAccent = (color: string) => {
    setAccentColor(color)
    document.documentElement.style.setProperty('--color-accent', color)
  }

  const processFile = useCallback(async (file: File, password?: string) => {
    const update = (patch: Partial<FileEntry>) => {
      setFiles((prev) => prev.map((f) => f.file.name === file.name ? { ...f, ...patch } : f))
    }
    update({ status: 'extracting' })
    try {
      const result = await extractPdfText(file, password)
      update({ status: 'ready', pageCount: result.pageCount, extractedText: result.text, passwordUsed: result.passwordUsed })
    } catch (err) {
      if (err instanceof PasswordRequiredError) {
        update({ status: 'password_required' })
      } else {
        update({ status: 'failed', error: err instanceof Error ? err.message : 'Extraction failed' })
      }
    }
  }, [])

  const addFiles = useCallback(async (newFiles: File[]) => {
    const pdfs = newFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    const entries: FileEntry[] = pdfs.map((f) => ({ file: f, status: 'extracting' }))
    setFiles((prev) => {
      const names = new Set(prev.map((e) => e.file.name))
      return [...prev, ...entries.filter((e) => !names.has(e.file.name))]
    })
    for (const f of pdfs) await processFile(f)
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleRemove = (name: string) => {
    const idx = state.raw_statements.findIndex((s) => s.file_name === name)
    if (idx !== -1) dispatch({ type: 'REMOVE_STATEMENT', payload: idx })
    setFiles((prev) => prev.filter((f) => f.file.name !== name))
  }

  const readyFiles = files.filter((f) => f.status === 'ready')

  const handleAnalyse = async () => {
    if (readyFiles.length === 0) return
    const statements = readyFiles.map((f) => ({
      file_name: f.file.name,
      extracted_text: f.extractedText ?? '',
      password_used: f.passwordUsed ?? false,
    }))
    dispatch({ type: 'SET_ANALYSIS_STATUS', payload: 'analysing' })
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      })
      if (!res.ok) {
        const err = await res.json()
        dispatch({ type: 'SET_ERROR', payload: err.error ?? 'Analysis failed' })
        return
      }
      dispatch({ type: 'SET_PARSED_DATA', payload: await res.json() })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Spend<span style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent)', fontStyle: 'italic' }}>Dash</span>
        </span>
        <nav className="flex items-center gap-6">
          <button
            onClick={() => setHowItWorksOpen(true)}
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-text)' }}
          >
            How it works
          </button>
          <button
            onClick={() => setPrivacyOpen(true)}
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--color-text)' }}
          >
            Privacy
          </button>
        </nav>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Announcement badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm mb-8"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
          New: ICICI credit card statements now supported
        </motion.div>

        {/* Hero heading */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-center mb-4"
        >
          <h1
            className="font-bold leading-tight"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.8rem, 6vw, 5rem)',
              color: 'var(--color-text)',
              lineHeight: 1.1,
            }}
          >
            Your money,
          </h1>
          <h1
            className="font-bold italic leading-tight"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.8rem, 6vw, 5rem)',
              color: 'var(--color-accent)',
              lineHeight: 1.15,
            }}
          >
            clearly.
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-center text-base max-w-md mb-10 leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Drop your Indian bank or credit card PDFs. AI-powered analysis
          — parsed privately in your browser, never uploaded anywhere.
        </motion.p>

        {/* Upload zone */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-lg"
        >
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            animate={isDragging
              ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 6px rgba(123,63,0,0.08)' }
              : { borderColor: 'var(--color-border)', boxShadow: '0 0 0 0px rgba(123,63,0,0)' }
            }
            transition={{ duration: 0.2 }}
            className="cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors"
            style={{ background: isDragging ? 'rgba(123,63,0,0.03)' : 'var(--color-surface)' }}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
            <Upload className="mx-auto mb-3" size={28} style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              Drag & drop your PDF statements
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              or{' '}
              <span className="underline underline-offset-2 cursor-pointer" style={{ color: 'var(--color-accent)' }}>
                click to browse
              </span>
              {' '}— multiple files supported
            </p>
          </motion.div>

          {/* Password warning */}
          <p className="mt-3 text-xs text-center flex items-center justify-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--color-amber)', flexShrink: 0 }} />
            Statement must <strong style={{ color: 'var(--color-text)' }}>not</strong> be password-protected — download directly from your bank&apos;s app.
          </p>

          {/* Bank chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {BANKS.map((bank) => (
              <span
                key={bank}
                className="text-xs px-3 py-1 rounded-full border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', background: 'var(--color-surface)' }}
              >
                {bank}
              </span>
            ))}
          </div>

          {/* File cards */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-6 space-y-3"
              >
                {files.map((entry) => (
                  <StatementCard
                    key={entry.file.name}
                    entry={entry}
                    onRemove={() => handleRemove(entry.file.name)}
                    onPasswordSubmit={(pwd) => processFile(entry.file, pwd)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {state.analysis_status === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 rounded-xl border text-sm"
              style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
            >
              {state.error_message}
            </motion.div>
          )}

          {/* Analyse button */}
          <AnimatePresence>
            {readyFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-6 flex justify-center"
              >
                <button
                  onClick={handleAnalyse}
                  className="px-8 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  Analyse {readyFiles.length} statement{readyFiles.length !== 1 ? 's' : ''} →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* ── Bottom feature strip ──────────────────────────────────────── */}
      <footer
        className="border-t grid grid-cols-2 sm:grid-cols-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderLeft: i > 0 ? `1px solid var(--color-border)` : undefined }}
          >
            <span className="text-xl">{f.icon}</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{f.title}</p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </footer>

      {/* ── Tweaks panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {tweaksOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 rounded-2xl border shadow-lg p-4 w-56 z-50"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Tweaks</span>
              <button onClick={() => setTweaksOpen(false)} style={{ color: 'var(--color-text-muted)' }}>
                <X size={14} />
              </button>
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Theme</p>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Accent colour</p>
            <div className="flex gap-2">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => applyAccent(c.value)}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
                  style={{ background: c.value }}
                  title={c.label}
                >
                  {accentColor === c.value && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!tweaksOpen && (
        <button
          onClick={() => setTweaksOpen(true)}
          className="fixed bottom-20 right-4 text-xs px-3 py-1.5 rounded-full border z-50"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          Tweaks
        </button>
      )}

      {/* ── How it works modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {howItWorksOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.4)' }}
            onClick={() => setHowItWorksOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl border p-8 max-w-md w-full"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}>How it works</h2>
                <button onClick={() => setHowItWorksOpen(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
              </div>
              <ol className="space-y-4">
                {[
                  { n: '1', t: 'Download your statement', d: 'Get the PDF directly from your bank\'s app or website.' },
                  { n: '2', t: 'Drop it here', d: 'Your PDF is read entirely in your browser — nothing is uploaded.' },
                  { n: '3', t: 'AI analyses it', d: 'Claude AI categorises transactions and surfaces insights.' },
                  { n: '4', t: 'Explore your dashboard', d: 'Charts, trends, and actionable tips — all from your real data.' },
                ].map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{s.n}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{s.t}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Privacy modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {privacyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.4)' }}
            onClick={() => setPrivacyOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl border p-8 max-w-md w-full"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}>Privacy</h2>
                <button onClick={() => setPrivacyOpen(false)} style={{ color: 'var(--color-text-muted)' }}><X size={18} /></button>
              </div>
              <div className="space-y-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <p><strong style={{ color: 'var(--color-text)' }}>Your data never leaves your device.</strong> PDF text is extracted entirely in your browser using PDF.js.</p>
                <p>The extracted text is sent to Claude AI (Anthropic) for categorisation and insight generation. No raw PDF is ever uploaded.</p>
                <p>No account required. No cookies. No analytics. Nothing is stored after your session ends.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
