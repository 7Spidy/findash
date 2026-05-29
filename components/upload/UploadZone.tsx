'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
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

function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return mobile
}

// ── Modal shell ──────────────────────────────────────────────────────────────

function SDModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const isMobile = useIsMobile()
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        className="fixed inset-0 z-50 flex justify-center"
        style={{
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(5px)',
          alignItems: isMobile ? 'flex-end' : 'center',
          padding: isMobile ? 0 : 32,
        }}
      >
        <motion.div
          initial={isMobile ? { y: 60, opacity: 0 } : { scale: 0.96, opacity: 0 }}
          animate={isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { y: 60, opacity: 0 } : { scale: 0.96, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{
            background: '#FFFFFF',
            borderRadius: isMobile ? '16px 16px 0 0' : 16,
            maxWidth: 620,
            width: '100%',
            maxHeight: isMobile ? '88vh' : '82vh',
            overflowY: 'auto',
            padding: isMobile ? '28px 24px 36px' : '36px 40px',
            position: 'relative',
            boxShadow: '0 28px 80px rgba(0,0,0,0.14)',
            border: '1px solid #E6E0D4',
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 30, height: 30, borderRadius: 8,
              background: '#F3F0E9', border: '1px solid #E6E0D4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, color: '#6B7280', lineHeight: 1,
            }}
          >
            ✕
          </button>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── How It Works Modal ───────────────────────────────────────────────────────

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const steps = [
    {
      icon: '📄', num: '01', title: 'Upload your statement',
      body: 'Drag and drop — or tap to browse — your PDF bank or credit card statement. Supports HDFC, ICICI, SBI, Axis, Kotak, and AMEX. Multiple files supported. Your PDF must not be password-protected.',
    },
    {
      icon: '🔒', num: '02', title: 'Instant local parsing',
      body: 'Your PDF is parsed entirely inside your browser. No file is ever transmitted to any server. Your financial data stays on your device — we have zero access to it.',
    },
    {
      icon: '🤖', num: '03', title: 'AI-powered analysis',
      body: 'Claude AI analyses your transactions, identifies categories, flags unusual activity, and generates personalised insights tailored to your habits — in seconds.',
    },
    {
      icon: '✨', num: '04', title: 'Explore your dashboard',
      body: 'View category breakdowns, top merchants, card summaries, and AI recommendations. Download a clean PDF summary whenever you need.',
    },
  ]
  return (
    <SDModal onClose={onClose}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 6, color: '#0F172A' }}>
        How it works
      </h2>
      <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 24, lineHeight: 1.65 }}>
        SpendDash turns your raw bank statements into clear, actionable insights in a few steps.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {steps.map((s) => (
          <div key={s.num} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: 10,
              background: '#F3F0E9', border: '1px solid #E6E0D4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {s.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#7B3F00', fontWeight: 700, letterSpacing: '0.07em' }}>{s.num}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{s.title}</span>
              </div>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.68, margin: 0 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 22, padding: '12px 14px',
        background: '#F7EFE6', border: '1px solid #E8C9A0',
        borderRadius: 9, fontSize: 13, color: '#7B3F00', fontWeight: 500, lineHeight: 1.55,
      }}>
        💡 <strong>Tip:</strong> Download your PDF directly from your bank&apos;s official app or net banking portal for best results.
      </div>
    </SDModal>
  )
}

// ── Privacy Modal ────────────────────────────────────────────────────────────

function PrivacyModal({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: '🔒', title: 'No server uploads — ever',   body: "Your PDFs are never transmitted to any server. All parsing happens locally in your browser. The file never leaves your device." },
    { icon: '🗑️', title: 'Zero data retention',       body: "We don't save, log, or retain any financial data. Close the tab and everything is gone. No database, no cloud storage." },
    { icon: '👤', title: 'No account required',        body: 'Zero sign-up, no email, no login. Open the page, upload your statement, get insights — no strings attached.' },
    { icon: '🤖', title: 'AI transparency',            body: 'Only anonymised transaction summaries — no account numbers, card numbers, or names — are sent to Claude AI for analysis.' },
    { icon: '💻', title: 'Open source',                body: 'Fully open source on GitHub. Inspect every line of code to verify how your data is handled.' },
  ]
  return (
    <SDModal onClose={onClose}>
      <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 6, color: '#0F172A' }}>
        Privacy first, always
      </h2>
      <p style={{ fontSize: 13.5, color: '#6B7280', marginBottom: 22, lineHeight: 1.65 }}>
        Your financial data is deeply personal. Here&apos;s exactly how SpendDash handles it.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div key={item.title} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            padding: '12px 14px', background: '#F3F0E9',
            borderRadius: 10, border: '1px solid #E6E0D4',
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A', marginBottom: 3 }}>{item.title}</div>
              <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </SDModal>
  )
}

// ── Upload icon in a box ─────────────────────────────────────────────────────

function UploadBox({ dragOver }: { dragOver: boolean }) {
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 10,
      background: dragOver ? '#F7EFE6' : '#F3F0E9',
      border: `1px solid ${dragOver ? '#E8C9A0' : '#E6E0D4'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#7B3F00' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function UploadZone() {
  const { state, dispatch } = useAppState()
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [modal, setModal] = useState<'how-it-works' | 'privacy' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const processFile = useCallback(async (file: File, password?: string) => {
    const update = (patch: Partial<FileEntry>) =>
      setFiles((prev) => prev.map((f) => f.file.name === file.name ? { ...f, ...patch } : f))
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

  const hPad = isMobile ? '0 20px' : '0 80px'

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#FAF8F3',
      fontFamily: "'DM Sans', sans-serif", overflow: 'hidden',
      position: 'relative', color: '#0F172A', display: 'flex', flexDirection: 'column',
    }}>

      {/* Dot grid — desktop only */}
      {!isMobile && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none', zIndex: 0,
        }} />
      )}

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: hPad, height: isMobile ? 56 : 72,
        borderBottom: '1px solid #E6E0D4',
        position: 'relative', zIndex: 2, background: '#FAF8F3', flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: isMobile ? 18 : 22, letterSpacing: '-0.01em', color: '#0F172A' }}>
          Spend<em style={{ fontStyle: 'italic' }}>Dash</em>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 20 : 32 }}>
          {([['How it works', 'how-it-works'], ['Privacy', 'privacy']] as const).map(([label, id]) => (
            <button
              key={id}
              onClick={() => setModal(id)}
              style={{ fontSize: isMobile ? 13 : 14, color: '#6B7280', cursor: 'pointer', fontWeight: 500, background: 'none', border: 'none', padding: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#0F172A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6B7280')}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', position: 'relative', zIndex: 1,
        padding: isMobile ? '0 20px 72px' : '0 40px 80px',
        overflowY: isMobile ? 'auto' : 'hidden',
      }}>

        {/* Announcement pill — desktop only */}
        {!isMobile && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 14px', background: '#FFFFFF',
            border: '1px solid #E6E0D4', borderRadius: 100,
            fontSize: 12, color: '#7B3F00', fontWeight: 600, marginBottom: 28,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7B3F00', flexShrink: 0 }} />
            New: ICICI credit card statements now supported
          </div>
        )}

        {/* H1 */}
        <h1 style={{
          fontFamily: "'Playfair Display',serif", fontWeight: 800,
          fontSize: isMobile ? 42 : 80, lineHeight: 1.06,
          letterSpacing: '-0.03em', textAlign: 'center',
          marginBottom: isMobile ? 16 : 22, margin: `0 0 ${isMobile ? 16 : 22}px`,
        }}>
          Your money,<br />
          <em style={{ fontStyle: 'italic', color: '#7B3F00' }}>clearly.</em>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: isMobile ? 15 : 16.5, color: '#6B7280', textAlign: 'center',
          maxWidth: isMobile ? 340 : 500, lineHeight: 1.76,
          marginBottom: isMobile ? 24 : 34,
        }}>
          Drop your Indian bank or credit card PDFs. AI-powered analysis — parsed privately in your browser, never uploaded anywhere.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: isMobile ? '100%' : 520,
            minHeight: isMobile ? 120 : 148,
            border: `2px dashed ${isDragging ? '#7B3F00' : '#D4CDBE'}`,
            borderRadius: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            background: isDragging ? '#F7EFE6' : '#FFFFFF',
            cursor: 'pointer',
            boxShadow: isDragging ? '0 0 0 4px #F7EFE6' : '0 2px 16px rgba(0,0,0,0.04)',
            transition: 'all 0.2s ease',
            padding: '20px 16px',
          }}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) addFiles(Array.from(e.target.files)) }} />
          <UploadBox dragOver={isDragging} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 14 : 14.5, fontWeight: 600, color: '#0F172A' }}>
              {isMobile ? 'Tap to upload your PDF' : 'Drag & drop your PDF statements'}
            </div>
            <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 3 }}>
              {isMobile
                ? 'HDFC, ICICI, SBI, Axis & more'
                : <span>or <span style={{ color: '#2563EB', fontWeight: 500 }}>click to browse</span> — multiple files supported</span>
              }
            </div>
          </div>
        </div>

        {/* Password warning */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          marginTop: 11, fontSize: 12, color: '#6B7280',
          maxWidth: isMobile ? '100%' : 520,
          textAlign: 'center', justifyContent: 'center',
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>Statement must <strong style={{ color: '#0F172A' }}>not</strong> be password-protected — download directly from your bank&apos;s app.</span>
        </div>

        {/* Bank pills — desktop */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['HDFC Bank', 'ICICI Bank', 'State Bank', 'Axis Bank', 'Kotak', 'AMEX'].map((b) => (
              <span key={b} style={{
                padding: '5px 12px', background: '#FFFFFF',
                border: '1px solid #E6E0D4', borderRadius: 6,
                fontSize: 11.5, color: '#6B7280', fontWeight: 500,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>{b}</span>
            ))}
          </div>
        )}

        {/* Bank pills — mobile horizontal scroll */}
        {isMobile && (
          <div style={{ display: 'flex', gap: 7, marginTop: 14, overflowX: 'auto', width: '100%', paddingBottom: 4 }}>
            {['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak', 'AMEX'].map((b) => (
              <span key={b} style={{
                padding: '4px 10px', background: '#FFFFFF',
                border: '1px solid #E6E0D4', borderRadius: 6,
                fontSize: 11.5, color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
              }}>{b}</span>
            ))}
          </div>
        )}

        {/* File cards */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ marginTop: 20, width: isMobile ? '100%' : 520, display: 'flex', flexDirection: 'column', gap: 12 }}
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
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 10,
            border: '1px solid #DC2626', background: 'rgba(220,38,38,0.06)',
            fontSize: 13, color: '#DC2626', width: isMobile ? '100%' : 520,
          }}>
            {state.error_message}
          </div>
        )}

        {/* Analyse button */}
        <AnimatePresence>
          {readyFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{ marginTop: 20 }}
            >
              <button
                onClick={handleAnalyse}
                style={{
                  padding: '11px 32px', borderRadius: 10,
                  background: '#7B3F00', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  border: 'none', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(123,63,0,0.18)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Analyse {readyFiles.length} statement{readyFiles.length !== 1 ? 's' : ''} →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FEATURE STRIP ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: isMobile ? 52 : 76,
        borderTop: '1px solid #E6E0D4', background: '#FFFFFF',
        padding: hPad,
        display: 'flex', alignItems: 'center', zIndex: 2,
      }}>
        {isMobile ? (
          <>
            <div style={{ flex: 1, display: 'flex', gap: 16, alignItems: 'center', fontSize: 11.5, color: '#9CA3AF' }}>
              <span>🔒 Private</span>
              <span>⚡ Instant</span>
              <span>🇮🇳 Indian banks</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Made with ❤️ by Avi</div>
          </>
        ) : (
          <>
            {[
              { icon: '🔒', title: 'Zero storage',    desc: 'Parsed in your browser'   },
              { icon: '⚡', title: 'Instant results',  desc: 'AI insights in seconds'  },
              { icon: '🤖', title: 'Claude AI',        desc: 'Smart pattern analysis'  },
              { icon: '🇮🇳', title: 'Indian banks',   desc: 'HDFC, ICICI, SBI & more' },
            ].map((f, i) => (
              <div key={f.title} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 11,
                padding: '0 24px',
                borderRight: i < 3 ? '1px solid #E6E0D4' : 'none',
              }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{f.title}</div>
                  <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>{f.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 12, color: '#9CA3AF', paddingLeft: 24, borderLeft: '1px solid #E6E0D4', whiteSpace: 'nowrap' }}>
              Made with ❤️ by Avi
            </div>
          </>
        )}
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────── */}
      {modal === 'how-it-works' && <HowItWorksModal onClose={() => setModal(null)} />}
      {modal === 'privacy'      && <PrivacyModal    onClose={() => setModal(null)} />}
    </div>
  )
}
