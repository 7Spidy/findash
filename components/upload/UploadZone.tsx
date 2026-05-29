'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Upload, Moon, Sun, Plus, ArrowRight } from 'lucide-react'
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

interface UploadZoneProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

const CURRENCY_SYMBOLS = ['$', '₹', '£', '€', '$', '₹', '¥', '€']

export default function UploadZone({ theme, onThemeToggle }: UploadZoneProps) {
  const { state, dispatch } = useAppState()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const analysisSteps = [
    'Parsing statements...',
    'Categorising transactions...',
    'Generating insights...',
    'Building your dashboard...',
  ]

  // Stable particles — generated once, varying positions/speeds/sizes
  const particles = useMemo(() =>
    Array.from({ length: 26 }, (_, i) => ({
      id: i,
      symbol: CURRENCY_SYMBOLS[i % CURRENCY_SYMBOLS.length],
      left: `${(i * 3.9 + 1.5) % 97}%`,
      fontSize: `${15 + (i % 6) * 4}px`,
      opacity: 0.05 + (i % 5) * 0.028,
      duration: `${8 + (i % 9) * 1.6}s`,
      delay: `${-(i * 1.9)}s`,
    })), [])

  const processFile = useCallback(async (file: File, password?: string) => {
    const update = (patch: Partial<FileEntry>) => {
      setFiles((prev) => prev.map((f) => f.file.name === file.name ? { ...f, ...patch } : f))
    }

    update({ status: 'extracting' })
    try {
      const result = await extractPdfText(file, password)
      update({
        status: 'ready',
        pageCount: result.pageCount,
        extractedText: result.text,
        passwordUsed: result.passwordUsed,
      })
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
    for (const f of pdfs) {
      await processFile(f)
    }
  }, [processFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }, [addFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handlePasswordSubmit = async (file: File, password: string) => {
    await processFile(file, password)
  }

  const handleRemove = (name: string) => {
    const idx = state.raw_statements.findIndex((s) => s.file_name === name)
    if (idx !== -1) dispatch({ type: 'REMOVE_STATEMENT', payload: idx })
    setFiles((prev) => prev.filter((f) => f.file.name !== name))
  }

  const readyFiles = files.filter((f) => f.status === 'ready')

  const handleAnalyse = async () => {
    if (readyFiles.length === 0) return
    setIsAnalysing(true)

    const statements = readyFiles.map((f) => ({
      file_name: f.file.name,
      extracted_text: f.extractedText ?? '',
      password_used: f.passwordUsed ?? false,
    }))

    dispatch({ type: 'SET_ANALYSIS_STATUS', payload: 'analysing' })

    const stepInterval = setInterval(() => {
      setAnalysisStep((s) => Math.min(s + 1, analysisSteps.length - 1))
    }, 3000)

    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements }),
      })
      clearInterval(stepInterval)

      if (!res.ok) {
        const err = await res.json()
        dispatch({ type: 'SET_ERROR', payload: err.error ?? 'Analysis failed' })
        setIsAnalysing(false)
        return
      }

      const data = await res.json()
      dispatch({ type: 'SET_PARSED_DATA', payload: data })
    } catch (err) {
      clearInterval(stepInterval)
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Network error' })
      setIsAnalysing(false)
    }
  }

  if (isAnalysing) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{ background: ['linear-gradient(135deg, #14b8a6 0%, #0f0f0f 50%, #14b8a6 100%)', 'linear-gradient(225deg, #0f0f0f 0%, #14b8a6 50%, #0f0f0f 100%)'] }}
          transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse' }}
        />
        <div className="relative z-10 text-center px-8">
          <motion.div
            className="w-16 h-16 rounded-full border-2 border-accent mx-auto mb-8"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={analysisStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xl font-medium"
              style={{ color: 'var(--color-text)' }}
            >
              {analysisSteps[analysisStep]}
            </motion.p>
          </AnimatePresence>
          <div className="flex gap-2 justify-center mt-6">
            {analysisSteps.map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: i <= analysisStep ? 'var(--color-accent)' : 'var(--color-border)' }}
                animate={{ scale: i === analysisStep ? 1.3 : 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* Currency rain */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="currency-particle"
            style={{
              left: p.left,
              fontSize: p.fontSize,
              ['--p-opacity' as string]: p.opacity,
              opacity: 0,
              animationDuration: p.duration,
              animationDelay: p.delay,
            }}
          >
            {p.symbol}
          </span>
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6">
        <span className="text-2xl font-bold" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-accent)' }}>
          Spend Dash
        </span>
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-full transition-colors"
          style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl mb-3" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-text)' }}>
              Drop your statements.
            </h1>
            <h1 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Instrument Serif, serif', color: 'var(--color-accent)' }}>
              Get clarity.
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
              Upload Indian bank or credit card PDFs — parsed privately, never stored.
            </p>
          </div>

          {/* Drop zone with slow outward pulse */}
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            animate={isDragging
              ? { borderColor: '#14b8a6', boxShadow: '0 0 0 8px rgba(20,184,166,0.18)' }
              : {
                  borderColor: 'rgba(255,255,255,0.08)',
                  boxShadow: [
                    '0 0 0 0px rgba(20,184,166,0)',
                    '0 0 0 10px rgba(20,184,166,0.10)',
                    '0 0 0 0px rgba(20,184,166,0)',
                  ],
                }
            }
            transition={isDragging
              ? { duration: 0.2 }
              : { boxShadow: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }, borderColor: { duration: 0.2 } }
            }
            className="relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center"
            style={{
              background: isDragging ? 'rgba(20,184,166,0.05)' : 'var(--color-surface)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <Upload className="mx-auto mb-4" size={36} style={{ color: isDragging ? '#14b8a6' : 'var(--color-text-muted)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--color-text)' }}>
              Drag & drop PDF statements here
            </p>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              or click to browse — multiple files supported
            </p>
          </motion.div>

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
                    onPasswordSubmit={(pwd) => handlePasswordSubmit(entry.file, pwd)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error message */}
          {state.analysis_status === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 rounded-xl border text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
            >
              {state.error_message}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Made with ❤️ by Avi
      </div>

      {/* Bottom action bar */}
      <AnimatePresence>
        {readyFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-5 border-t z-20"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <Plus size={16} /> Add More
            </button>
            <button
              onClick={handleAnalyse}
              disabled={readyFiles.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#fff' }}
            >
              Analyse <ArrowRight size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
