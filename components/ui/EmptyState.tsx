import { FileX } from 'lucide-react'

export default function EmptyState({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <FileX size={36} style={{ color: 'var(--color-text-muted)' }} />
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
  )
}
