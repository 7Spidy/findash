'use client'

import { useState } from 'react'
import { X, CheckCircle, Lock, AlertCircle, Loader2, FileText } from 'lucide-react'
import { motion } from 'framer-motion'

interface FileEntry {
  file: File
  status: 'extracting' | 'ready' | 'password_required' | 'failed'
  pageCount?: number
  error?: string
  passwordUsed?: boolean
}

interface StatementCardProps {
  entry: FileEntry
  onRemove: () => void
  onPasswordSubmit: (password: string) => Promise<void>
}

export default function StatementCard({ entry, onRemove, onPasswordSubmit }: StatementCardProps) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setSubmitting(true)
    await onPasswordSubmit(password)
    setSubmitting(false)
  }

  const statusIcon = () => {
    switch (entry.status) {
      case 'extracting': return <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      case 'ready':      return <CheckCircle size={16} style={{ color: 'var(--color-green)' }} />
      case 'password_required': return <Lock size={16} style={{ color: 'var(--color-amber)' }} />
      case 'failed':     return <AlertCircle size={16} style={{ color: 'var(--color-red)' }} />
    }
  }

  const statusText = () => {
    switch (entry.status) {
      case 'extracting': return 'Extracting...'
      case 'ready':      return `Ready · ${entry.pageCount ?? 0} pages`
      case 'password_required': return 'Password required'
      case 'failed':     return entry.error ?? 'Failed'
    }
  }

  const statusColor = () => {
    switch (entry.status) {
      case 'extracting': return 'var(--color-text-muted)'
      case 'ready':      return 'var(--color-green)'
      case 'password_required': return 'var(--color-amber)'
      case 'failed':     return 'var(--color-red)'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="rounded-xl border p-4"
      style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
              {entry.file.name}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {statusIcon()}
              <span className="text-xs" style={{ color: statusColor() }}>
                {statusText()}
              </span>
            </div>

            {entry.status === 'password_required' && (
              <form onSubmit={handlePasswordSubmit} className="flex gap-2 mt-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter PDF password"
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting || !password.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Unlock'}
                </button>
              </form>
            )}
          </div>
        </div>

        {entry.status !== 'extracting' && (
          <button
            onClick={onRemove}
            className="p-1 rounded-full transition-colors flex-shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </motion.div>
  )
}
