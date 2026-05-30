export default function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 animate-pulse ${className}`}
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="h-3 w-24 rounded mb-4" style={{ background: 'var(--color-surface-2)' }} />
      <div className="h-8 w-40 rounded mb-3" style={{ background: 'var(--color-surface-2)' }} />
      <div className="h-3 w-32 rounded" style={{ background: 'var(--color-surface-2)' }} />
    </div>
  )
}
