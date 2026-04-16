import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import { getActionItems, getFormData } from '../../utils/hitl'
import { ActionButtons } from './ActionButtons'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'

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
  const summary = intervention.interrupt_message?.context?.summary

  const [values, setValues] = useState<Record<string, unknown>>(
    () => ({ ...(form?.current_values ?? {}) })
  )

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

  const actionItems = getActionItems(intervention)

  const origin = (values.origin as string) ?? '—'
  const destination = (values.destination as string) ?? '—'
  const mode = (values.mode as string) ?? '—'
  const weight = values.weight_kg != null ? `${values.weight_kg} kg` : '—'

  return (
    <div className="approval-card type-confirm">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="blue" dot={false}>Confirm Shipment</Badge>
            </span>
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

      <div className="hitl-form">
        {form.schema.map((field) => {
          const value = values[field.key]
          const options = form.resolved_options[field.key]

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

      {summary && (
        <div className="approval-rec">{summary}</div>
      )}

      <ActionButtons
        actions={actionItems}
        loading={loading}
        buildBody={(item) => ({
          action: item.id,
          edited_values: computeEdits(),
        })}
        onSubmit={onAction}
      />
    </div>
  )
}
