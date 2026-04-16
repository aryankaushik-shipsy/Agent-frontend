import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Button } from './Button'

type ConfirmVariant = 'danger' | 'neutral'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const confirmVariant = variant === 'danger' ? 'red-outline' : 'primary'

  return (
    <div
      onClick={loading ? undefined : onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff', borderRadius: 8, maxWidth: 440, width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}
      >
        {title && (
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--gray-100)',
            fontWeight: 600, fontSize: 15,
            color: variant === 'danger' ? '#991b1b' : 'var(--gray-800, #1f2937)',
          }}>
            {title}
          </div>
        )}
        <div style={{
          padding: '16px 20px', fontSize: 13, lineHeight: 1.5,
          color: 'var(--gray-700, #374151)',
        }}>
          {message}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--gray-100)',
          background: 'var(--gray-50, #f9fafb)',
        }}>
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
