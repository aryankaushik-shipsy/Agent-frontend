import { useState } from 'react'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { InstructionDialog } from './InstructionDialog'
import type { HITLActionRequest } from '../../api/hitl'
import type { InterruptActionItem, ActionStyle } from '../../types/hitl'

interface ActionButtonsProps {
  actions: InterruptActionItem[]
  // Called when an action button is clicked and (if applicable) confirmed.
  // Parent is responsible for assembling the body — typically { action: item.id, edited_values, selected_candidate_id, ... }
  buildBody: (item: InterruptActionItem) => HITLActionRequest
  onSubmit: (body: HITLActionRequest) => void
  loading?: boolean
  // Per-item disabled predicate (e.g. disable "Select Carrier" until a row is picked)
  disabled?: (item: InterruptActionItem) => boolean
  // Optional inline instruction-field — if provided, the dashboard adds a compact textarea
  // above the buttons so the user can type a free-text retrigger hint without a modal. When
  // used, retrigger actions submit with that instruction directly; the "…with instruction"
  // split-button modal is still available for longer prompts.
  className?: string
}

function variantFromStyle(style?: ActionStyle): 'primary' | 'ghost' | 'green' | 'red-outline' | 'yellow' {
  switch (style) {
    case 'danger': return 'red-outline'
    case 'success': return 'green'
    case 'secondary': return 'ghost'
    case 'primary':
    default: return 'primary'
  }
}

export function ActionButtons({
  actions,
  buildBody,
  onSubmit,
  loading = false,
  disabled,
  className,
}: ActionButtonsProps) {
  // When the user clicks a button with `confirm_required`, we store the chosen item here
  // and open a ConfirmDialog. `instructionItem` does the same for retrigger modals.
  const [pendingConfirm, setPendingConfirm] = useState<InterruptActionItem | null>(null)
  const [pendingInstruction, setPendingInstruction] = useState<InterruptActionItem | null>(null)

  if (!actions || actions.length === 0) return null

  function submit(item: InterruptActionItem, overrides?: Partial<HITLActionRequest>) {
    const body = { ...buildBody(item), ...overrides, action: item.id }
    onSubmit(body)
  }

  function handleClick(item: InterruptActionItem) {
    // Confirm when the policy asks for it explicitly, or when the action is
    // styled as destructive (danger) — better safe than sorry for irreversible steps.
    if (item.confirm_required || item.style === 'danger') {
      setPendingConfirm(item)
      return
    }
    submit(item)
  }

  function handleInstruction(item: InterruptActionItem) {
    setPendingInstruction(item)
  }

  return (
    <>
      <div className={className ?? 'approval-actions'}>
        {actions.map((item) => {
          const variant = variantFromStyle(item.style)
          const isDisabled = disabled?.(item) ?? false
          const isRetrigger = item.type === 'retrigger'

          return (
            <span key={item.id} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant={variant}
                loading={loading && !isRetrigger}
                disabled={isDisabled || loading}
                onClick={() => handleClick(item)}
              >
                {item.label}
              </Button>
              {isRetrigger && (
                <Button
                  variant="ghost"
                  disabled={isDisabled || loading}
                  onClick={() => handleInstruction(item)}
                  title="Send with a free-text instruction for the agent"
                  aria-label="Send with a free-text instruction for the agent"
                  style={{ padding: '6px 8px', minWidth: 0 }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 14, height: 14 }}
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </Button>
              )}
            </span>
          )
        })}
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={pendingConfirm?.label ? `${pendingConfirm.label}?` : 'Are you sure?'}
        message={pendingConfirm?.confirm_message ?? 'This action cannot be undone.'}
        confirmLabel={pendingConfirm?.label ?? 'Confirm'}
        variant={pendingConfirm?.style === 'danger' ? 'danger' : 'neutral'}
        loading={loading}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const item = pendingConfirm
          setPendingConfirm(null)
          if (item) submit(item)
        }}
      />

      <InstructionDialog
        open={pendingInstruction !== null}
        title={pendingInstruction?.label ? `${pendingInstruction.label}` : 'Retrigger with instruction'}
        loading={loading}
        onCancel={() => setPendingInstruction(null)}
        onSubmit={({ instruction, note }) => {
          const item = pendingInstruction
          setPendingInstruction(null)
          if (item) submit(item, { instruction, note })
        }}
      />
    </>
  )
}
