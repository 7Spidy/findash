'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { Upload, Plus, ArrowRight } from 'lucide-react'
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

const CURRENCY_SYMBOLS = ['$', '₹', '£', '€', '$', '₹', '¥', '€']

export default function UploadZone() {
  const { state, dispatch } = useAppState()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const particles = useMemo(() =>
    Array.from({ length: 26 }, (_, i) => ({
      id: i,
      symbol: CURRENCY_SYMBOLS[i % CURRENCY_SYMBOLS.length],
      left: `${(i * 3.9 + 1.5) % 97}%`,
      fontSize: `${15 + (i % 6) * 4}px`,
      opacity: 0.04 + (i % 5) * 0.018,
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
    addFiles(Array.from(e.dataTransfer.files))
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

      const data = await res.json()
      dispatch({ type: 'SET_PARSED_DATA', payload: data })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Network error' })
    }
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
        <span
          className="text-2xl font-bold italic"
          style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent)' }}
        >
          SpendDash
        </span>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <h1
              className="text-4xl md:text-5xl font-bold italic mb-3 leading-tight"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}
            >
              Understand your money
            </h1>
            <p className="text-base" style={{ color: 'var(--color-text-muted)' }}>
              Upload Indian bank or credit card PDFs — parsed privately, never stored.
            </p>
          </div>

          {/* Drop zone */}
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            animate={isDragging
              ? { borderColor: '#7B3F00', boxShadow: '0 0 0 8px rgba(123,63,0,0.10)' }
              : {
                  borderColor: '#E6E0D4',
                  boxShadow: [
                    '0 0 0 0px rgba(123,63,0,0)',
                    '0 0 0 8px rgba(123,63,0,0.06)',
                    '0 0 0 0px rgba(123,63,0,0)',
                  ],
                }
            }
            transition={isDragging
              ? { duration: 0.2 }
              : { boxShadow: { duration: 3, repeat: Infinity, ease: 'easeInOut' }, borderColor: { duration: 0.2 } }
            }
            className="relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center"
            style={{
              background: isDragging ? 'rgba(123,63,0,0.04)' : 'var(--color-surface)',
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
            <Upload
              className="mx-auto mb-4"
              size={36}
              style={{ color: isDragging ? '#7B3F00' : 'var(--color-text-muted)' }}
            />
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
              style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'var(--color-red)', color: 'var(--color-red)' }}
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
