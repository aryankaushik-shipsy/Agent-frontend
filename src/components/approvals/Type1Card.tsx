import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import { getActionItems, getFormData } from '../../utils/hitl'
import { ActionButtons } from './ActionButtons'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'
import type { InterruptActionItem } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  onAction: (body: HITLActionRequest) => void
  loading: boolean
}

export function Type1Card({ job, intervention, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const form = getFormData(intervention)
  const msg = intervention.interrupt_message
  const ctx = msg?.context ?? {}
  const constraints = msg?.constraints ?? {}

  // Everything below is derived from the interrupt payload — no hardcoded
  // field names, labels, action ids, or constraints.
  const title        = msg?.title
  const description  = msg?.description
  const summary      = ctx.summary
  const recommendation = ctx.recommendation
  const confidence   = ctx.confidence_score
  const showRec      = constraints.show_ai_recommendation !== false

  const noteLabel     = constraints.note_label ?? 'Note (optional)'
  const requireNote   = constraints.require_note === true
  const noteMaxLength = constraints.note_max_length ?? undefined

  const retriggersUsed    = constraints.retriggers_used ?? 0
  const maxRetriggers     = constraints.max_retrigger_attempts ?? Infinity
  const retriggerExhausted = retriggersUsed >= maxRetriggers

  const [values, setValues] = useState<Record<string, unknown>>(
    () => ({ ...(form?.current_values ?? {}) })
  )
  const [note, setNote] = useState('')

  if (!form) return null

  function handleChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function computeEdits(): Record<string, unknown> {
    const edits: Record<string, unknown> = {}
    for (const field of form!.schema) {
      if (!field.editable) continue
      const original = form!.current_values[field.key]
      const current = values[field.key]
      if (current !== original) edits[field.key] = current
    }
    return edits
  }

  function buildBody(item: InterruptActionItem): HITLActionRequest {
    const body: HITLActionRequest = { action: item.id }
    const edits = computeEdits()
    if (Object.keys(edits).length > 0) body.edited_values = edits
    const trimmedNote = note.trim()
    if (trimmedNote) body.note = trimmedNote
    return body
  }

  function isDisabled(item: InterruptActionItem): boolean {
    // Retrigger budget — disable once the policy's cap is hit
    if (item.type === 'retrigger' && retriggerExhausted) return true
    // Policy-required note
    if (requireNote && note.trim().length === 0) return true
    return false
  }

  const actionItems = getActionItems(intervention)

  // Header summary line (derived from form values if available, else from ai_response)
  const origin = (values.origin as string | undefined) ?? '—'
  const destination = (values.destination as string | undefined) ?? '—'
  const mode = (values.mode as string | undefined) ?? '—'
  const weight = values.weight_kg != null ? `${values.weight_kg} kg` : '—'

  return (
    <div className="approval-card type-confirm">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="blue" dot={false}>
                {title ?? 'Confirm Shipment'}
              </Badge>
            </span>
            {confidence != null && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-500)', fontWeight: 400 }}>
                confidence {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <div className="approval-sub">
            {customer} · {origin} → {destination} · {mode} · {weight}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
          <button
            onClick={() => navigate(`/audit/${job.id}`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Audit Trail →
          </button>
        </div>
      </div>

      {/* Policy-authored instructions to the reviewer */}
      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      <div className="hitl-form">
        {form.schema.map((field) => {
          const value = values[field.key]
          // Options may come from the schema itself or from the resolved_options map
          const options = field.options ?? form.resolved_options[field.key]

          if (!field.editable) {
            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <span className="hitl-form-static">
                  {value != null ? String(value) : '—'}
                </span>
              </div>
            )
          }

          if (field.type === 'select' && options) {
            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <select
                  className="hitl-form-select"
                  value={value != null ? String(value) : ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                >
                  <option value="">—</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )
          }

          if (field.type === 'number') {
            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <input
                  className="hitl-form-input"
                  type="number"
                  min={field.min ?? undefined}
                  max={field.max ?? undefined}
                  value={value != null ? String(value) : ''}
                  onChange={(e) => handleChange(field.key, e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            )
          }

          if (field.type === 'date') {
            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <input
                  className="hitl-form-input"
                  type="date"
                  value={value != null ? String(value) : ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              </div>
            )
          }

          return (
            <div key={field.key} className="hitl-form-row">
              <label className="hitl-form-label">{field.label}</label>
              <input
                className="hitl-form-input"
                type="text"
                value={value != null ? String(value) : ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
              />
            </div>
          )
        })}
      </div>

      {/* AI recommendation (respects constraints.show_ai_recommendation) */}
      {showRec && (recommendation || summary) && (
        <div className="approval-rec">{recommendation ?? summary}</div>
      )}

      {/* Policy-controlled note input — applies to both approve and retrigger */}
      <div className="hitl-form-row" style={{ marginTop: 10 }}>
        <label className="hitl-form-label">
          {noteLabel}
          {requireNote && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
        </label>
        <input
          className="hitl-form-input"
          type="text"
          value={note}
          maxLength={noteMaxLength}
          onChange={(e) => setNote(e.target.value)}
          placeholder={requireNote ? 'Required' : 'Optional context for the agent / audit trail'}
        />
      </div>

      {/* Show retrigger budget warning when it matters */}
      {maxRetriggers !== Infinity && retriggersUsed > 0 && (
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>
          Retriggers used: {retriggersUsed} / {maxRetriggers}
          {retriggerExhausted && <span style={{ color: '#dc2626', marginLeft: 6 }}>— cap reached</span>}
        </div>
      )}

      <ActionButtons
        actions={actionItems}
        loading={loading}
        disabled={isDisabled}
        buildBody={buildBody}
        onSubmit={onAction}
      />
    </div>
  )
}
