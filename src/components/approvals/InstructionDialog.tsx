import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'

interface InstructionDialogProps {
  open: boolean
  title?: string
  description?: string
  loading?: boolean
  onSubmit: (payload: { instruction: string; note?: string }) => void
  onCancel: () => void
}

export function InstructionDialog({
  open,
  title = 'Retrigger with instruction',
  description = 'Give the agent free-text guidance for its next attempt. Any edits you have made to the form will be sent along with this instruction.',
  loading = false,
  onSubmit,
  onCancel,
}: InstructionDialogProps) {
  const [instruction, setInstruction] = useState('')
  const [note, setNote] = useState('')

  // Reset whenever the dialog reopens
  useEffect(() => {
    if (open) {
      setInstruction('')
      setNote('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const canSubmit = instruction.trim().length > 0

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
          background: '#fff', borderRadius: 8, maxWidth: 560, width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--gray-100)',
          fontWeight: 600, fontSize: 15,
          color: 'var(--gray-800, #1f2937)',
        }}>
          {title}
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            fontSize: 13, lineHeight: 1.5, color: 'var(--gray-600, #4b5563)',
            marginBottom: 12,
          }}>
            {description}
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>
            Instruction for the agent
          </label>
          <textarea
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. The customer mentioned 2 pallets not 2 boxes, each 120x100x150cm. Re-extract dimensions accordingly."
            style={{
              width: '100%', minHeight: 110, resize: 'vertical',
              padding: '10px 12px', fontSize: 13, lineHeight: 1.4,
              border: '1px solid var(--gray-200)', borderRadius: 6,
              fontFamily: 'inherit', marginBottom: 14,
            }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>
            Internal note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why you're re-running (not sent to the customer)"
            style={{
              width: '100%',
              padding: '8px 12px', fontSize: 13,
              border: '1px solid var(--gray-200)', borderRadius: 6,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--gray-100)',
          background: 'var(--gray-50, #f9fafb)',
        }}>
          <Button variant="ghost" disabled={loading} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!canSubmit}
            onClick={() => onSubmit({ instruction: instruction.trim(), note: note.trim() || undefined })}
          >
            Submit & Retrigger
          </Button>
        </div>
      </div>
    </div>
  )
}
