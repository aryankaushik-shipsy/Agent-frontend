import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import { getActionItems, getToolArgsData } from '../../utils/hitl'
import { ActionButtons } from './ActionButtons'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'
import type { ToolArgUiHint } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  onAction: (body: HITLActionRequest) => void
  loading: boolean
}

/** Derive a human-readable label for an arg key from ui_schema or fall back to Title Case. */
function labelFor(key: string, hint?: ToolArgUiHint): string {
  if (hint?.label) return hint.label
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** HTML-formatted args render in an iframe preview (with an edit-mode toggle to textarea). */
function isHtmlFormat(hint?: ToolArgUiHint): boolean {
  return hint?.format === 'html'
}

export function Type3Card({ job, intervention, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const toolArgs = getToolArgsData(intervention)
  const summary = intervention.interrupt_message?.context?.summary

  // Editable arg keys come from the policy, not the dashboard. Seed local edit
  // state with the agent-generated values so "no change" == original.
  const originalArgs = toolArgs?.args ?? {}
  const argKeys = Object.keys(originalArgs)
  const uiSchema = toolArgs?.ui_schema ?? {}

  const [values, setValues] = useState<Record<string, unknown>>({ ...originalArgs })
  const [editMode, setEditMode] = useState<Record<string, boolean>>({})

  if (!toolArgs) return null

  const actionItems = getActionItems(intervention)

  function setValue(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }
  function toggleEdit(key: string) {
    setEditMode((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function computeEdits(): Record<string, unknown> {
    const edits: Record<string, unknown> = {}
    for (const key of argKeys) {
      if (values[key] !== originalArgs[key]) edits[key] = values[key]
    }
    return edits
  }

  return (
    <div className="approval-card type-email">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="purple" dot={false}>Email Review</Badge>
            </span>
          </div>
          <div className="approval-sub">{customer}</div>
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

      {summary && (
        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10, lineHeight: 1.5 }}>
          {summary}
        </div>
      )}

      {/* Render each editable arg exposed by the policy */}
      {argKeys.map((key) => {
        const hint = uiSchema[key]
        const html = isHtmlFormat(hint)
        const isEditing = editMode[key] ?? false
        const value = values[key]

        if (html) {
          // HTML body — iframe preview with a Preview ⇄ Edit toggle per field
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="hitl-form-label">{labelFor(key, hint)}</span>
                <button
                  onClick={() => toggleEdit(key)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
                    textDecoration: 'underline', textUnderlineOffset: 2,
                  }}
                >
                  {isEditing ? 'Preview' : 'Edit'}
                </button>
              </div>
              {isEditing ? (
                <textarea
                  className="hitl-form-input"
                  style={{ width: '100%', minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  value={value != null ? String(value) : ''}
                  onChange={(e) => setValue(key, e.target.value)}
                />
              ) : (
                <iframe
                  sandbox="allow-same-origin"
                  srcDoc={value != null ? String(value) : ''}
                  style={{
                    width: '100%', height: 240, border: '1px solid var(--gray-200)',
                    borderRadius: 6, background: '#fff',
                  }}
                  title={labelFor(key, hint)}
                />
              )}
              {hint?.description && (
                <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{hint.description}</div>
              )}
            </div>
          )
        }

        // Plain string arg — single-line input (or multi-line if the hint says so)
        const multiline = hint?.multiline === true
        return (
          <div key={key} className="hitl-form-row" style={{ marginBottom: 10 }}>
            <label className="hitl-form-label">{labelFor(key, hint)}</label>
            {multiline ? (
              <textarea
                className="hitl-form-input"
                style={{ width: '100%', minHeight: 80 }}
                value={value != null ? String(value) : ''}
                onChange={(e) => setValue(key, e.target.value)}
              />
            ) : (
              <input
                className="hitl-form-input"
                type="text"
                value={value != null ? String(value) : ''}
                onChange={(e) => setValue(key, e.target.value)}
              />
            )}
          </div>
        )
      })}

      <ActionButtons
        actions={actionItems}
        loading={loading}
        buildBody={(item) => {
          // Only goto-typed actions forward edited args. skip-typed actions
          // bypass the tool entirely, so edits are ignored.
          if (item.type !== 'goto') return { action: item.id }
          const edits = computeEdits()
          return Object.keys(edits).length > 0
            ? { action: item.id, edited_values: edits }
            : { action: item.id }
        }}
        onSubmit={onAction}
      />
    </div>
  )
}
