import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { getTierInfo, getCustomerName } from '../../utils/status'
import { getActionItems, getCandidateData, getFormData, formatFieldValue, humanizeKey } from '../../utils/hitl'
import { isAboveThreshold } from '../../utils/margin'
import { TIER_MINIMUMS } from '../../constants'
import { ActionButtons } from './ActionButtons'
import { FormFieldInput } from './FormFieldInput'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'
import type { CandidateOption, InterruptActionItem } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  subtype: 'type2_step0' | 'type2_step1' | 'type2_step2'
  onAction: (body: HITLActionRequest) => void
  loading: boolean
}

// ── Step 0: Carrier Selection ──────────────────────────────────────────────────

function Step0({ job, intervention, onAction, loading }: Omit<Props, 'subtype'>) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const candidateData = getCandidateData(intervention)
  const msg = intervention.interrupt_message
  const ctx = msg?.context ?? {}
  const constraints = msg?.constraints ?? {}
  const actionItems = getActionItems(intervention)

  // Everything in the header/body derives from the interrupt payload.
  const title        = msg?.title ?? 'Select Carrier'
  const description  = msg?.description
  const recommendation = ctx.recommendation
  const summary      = ctx.summary
  const showRec      = constraints.show_ai_recommendation !== false
  const stepIndex    = msg?.step_index ?? 0
  const totalSteps   = msg?.total_steps ?? 1

  const noteLabel     = constraints.note_label ?? 'Note (optional)'
  const requireNote   = constraints.require_note === true
  const noteMaxLength = constraints.note_max_length ?? undefined

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // Optional sibling input when the interaction also declares `free_text`.
  // Captured into state via the action's effects (e.g. carrier_selection_reason).
  const [freeText, setFreeText] = useState('')
  // Per-candidate edits keyed by id_field value. Only populated when the
  // chosen action declares `candidates.editable_fields` and the user edits
  // one of those fields on the currently-selected row.
  const [candidateEdits, setCandidateEdits] = useState<Record<string, unknown>>({})

  if (!candidateData) return null

  const { options, id_field, display_fields } = candidateData
  const hasFreeText = (msg?.interaction_type ?? []).includes('free_text')

  // Secondary fields to render on each card (skip id_field — it's the title).
  const metaFields = (display_fields ?? []).filter((f) => f !== id_field)

  function buildBody(item: InterruptActionItem): HITLActionRequest {
    const body: HITLActionRequest = { action: item.id }
    // `selected_candidate_id` only matters for actions that actually consume a
    // candidate (e.g. "select"); retrigger/skip actions like refetch_rates /
    // skip_to_end carry no selection.
    if (selectedId && item.candidates?.required) body.selected_candidate_id = selectedId
    const trimmedNote = note.trim()
    if (trimmedNote) body.note = trimmedNote
    const trimmedFreeText = freeText.trim()
    if (trimmedFreeText && hasFreeText) body.free_text = trimmedFreeText
    if (Object.keys(candidateEdits).length > 0 && item.candidates?.required) {
      body.candidate_edits = candidateEdits
    }
    return body
  }

  function isDisabled(item: InterruptActionItem): boolean {
    // Policy-declared candidate requirement drives the disabled state —
    // no more hardcoded "must select something before submit".
    if (item.candidates?.required && !selectedId) return true
    if (requireNote && note.trim().length === 0) return true
    return false
  }

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>{title}</Badge>
            </span>
            {totalSteps > 1 && (
              <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--gray-500)', fontWeight: 400 }}>
                Step {stepIndex + 1} of {totalSteps}
              </span>
            )}
          </div>
          <div className="approval-sub">{customer}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
          <button
            onClick={() => navigate(`/pipeline/${job.id}/quote`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Full Quote →
          </button>
        </div>
      </div>

      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      {showRec && (recommendation || summary) && (
        <div className="approval-rec">{recommendation ?? summary}</div>
      )}

      <div className="carrier-option-grid">
        {options.map((candidate: CandidateOption) => {
          const owner = candidate as unknown as Record<string, unknown>
          const id = String(owner[id_field] ?? '')
          const isSelected = selectedId === id
          const titleValue = String(owner[id_field] ?? '')
          // "Above $5K" flag is an org-level business rule, not a policy hint —
          // keep it only if the policy's display_fields includes grand_total.
          const showFlag = metaFields.includes('grand_total') &&
            typeof owner.grand_total === 'number' &&
            isAboveThreshold(owner.grand_total)

          return (
            <button
              key={id}
              className={`carrier-option-card${isSelected ? ' carrier-option-card--selected' : ''}`}
              onClick={() => setSelectedId(id)}
            >
              <div className="carrier-option-name">
                {titleValue}
                {showFlag && (
                  <span style={{ marginLeft: 6 }}>
                    <Badge variant="red" dot={false}>Above $5K</Badge>
                  </span>
                )}
              </div>

              {metaFields.map((field) => {
                // currency_code is folded into the corresponding money value by
                // formatFieldValue — don't render it as a separate row.
                if (field === 'currency_code') return null
                return (
                  <div key={field} className="carrier-option-meta-row" style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{humanizeKey(field)}</span>
                    <span style={{ color: 'var(--gray-800)' }}>
                      {formatFieldValue(field, owner[field], owner)}
                    </span>
                  </div>
                )
              })}
            </button>
          )
        })}
      </div>

      {/* Editable fields on the selected candidate, if the policy allows any */}
      {selectedId && actionItems.some((a) => (a.candidates?.editable_fields?.length ?? 0) > 0) && (
        <div className="hitl-form" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
            Edit the selected candidate before confirming:
          </div>
          {actionItems
            .flatMap((a) => a.candidates?.editable_fields ?? [])
            .filter((f, i, arr) => arr.indexOf(f) === i)
            .map((field) => {
              const selected = options.find(
                (o) => String((o as unknown as Record<string, unknown>)[id_field]) === selectedId
              ) as Record<string, unknown> | undefined
              const original = selected?.[field]
              const current = candidateEdits[field] ?? original
              return (
                <div key={field} className="hitl-form-row">
                  <label className="hitl-form-label">{humanizeKey(field)}</label>
                  <input
                    className="hitl-form-input"
                    type={typeof original === 'number' ? 'number' : 'text'}
                    value={current != null ? String(current) : ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      const next = typeof original === 'number'
                        ? (raw === '' ? null : Number(raw))
                        : raw
                      setCandidateEdits((prev) => {
                        if (next === original) {
                          const { [field]: _removed, ...rest } = prev
                          return rest
                        }
                        return { ...prev, [field]: next }
                      })
                    }}
                  />
                </div>
              )
            })}
        </div>
      )}

      {hasFreeText && (
        <div className="hitl-form-row" style={{ marginTop: 10 }}>
          <label className="hitl-form-label">Reviewer note</label>
          <textarea
            className="hitl-form-input"
            style={{ minHeight: 60, resize: 'vertical', fontFamily: 'inherit', width: '100%' }}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Why this choice? (stored with the audit trail)"
          />
        </div>
      )}

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
          placeholder={requireNote ? 'Required' : 'Optional context for the audit trail'}
        />
      </div>

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

// ── Step 1: Price Review ───────────────────────────────────────────────────────

function Step1({ job, intervention, onAction, loading }: Omit<Props, 'subtype'>) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const form = getFormData(intervention)
  const msg = intervention.interrupt_message
  const ctx = msg?.context ?? {}
  const constraints = msg?.constraints ?? {}
  const actionItems = getActionItems(intervention)

  // Everything — title, description, field schema, constraints — comes from
  // the payload. Business rules like tier min% / "Above $5K" flags aren't in
  // the policy, so they're not rendered here (the dedicated QuoteEditForm
  // page surfaces those contextual chips instead).
  const title        = msg?.title ?? 'Review Pricing'
  const description  = msg?.description
  const summary      = ctx.summary
  const recommendation = ctx.recommendation
  const confidence   = ctx.confidence_score
  const showRec      = constraints.show_ai_recommendation !== false
  const stepIndex    = msg?.step_index ?? 1
  const totalSteps   = msg?.total_steps ?? 1

  const noteLabel     = constraints.note_label ?? 'Note (optional)'
  const requireNote   = constraints.require_note === true
  const noteMaxLength = constraints.note_max_length ?? undefined

  const retriggersUsed = constraints.retriggers_used ?? 0
  const maxRetriggers  = constraints.max_retrigger_attempts ?? Infinity
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
      if (values[field.key] !== form!.current_values[field.key]) {
        edits[field.key] = values[field.key]
      }
    }
    return edits
  }

  function buildBody(item: InterruptActionItem): HITLActionRequest {
    const body: HITLActionRequest = { action: item.id }
    const edits = computeEdits()
    if (Object.keys(edits).length > 0) body.edited_values = edits
    const trimmed = note.trim()
    if (trimmed) body.note = trimmed
    return body
  }

  function isDisabled(item: InterruptActionItem): boolean {
    if (item.type === 'retrigger' && retriggerExhausted) return true
    if (requireNote && note.trim().length === 0) return true
    return false
  }

  // Derive the carrier name from whichever field in the schema looks like it
  // identifies the candidate (fallback: a field literally named "carrier").
  const carrierName = (values.carrier as string | undefined) ?? undefined

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>{title}</Badge>
            </span>
            {totalSteps > 1 && (
              <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--gray-500)', fontWeight: 400 }}>
                Step {stepIndex + 1} of {totalSteps}
              </span>
            )}
            {confidence != null && confidence < 1 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-500)', fontWeight: 400 }}>
                confidence {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <div className="approval-sub">
            {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
          <button
            onClick={() => navigate(`/pipeline/${job.id}/quote`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Full Quote →
          </button>
        </div>
      </div>

      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      <div className="hitl-form">
        {form.schema.map((field) => {
          const resolved = form.resolved_options[field.key] ?? (field.options ?? undefined)
          return (
            <div key={field.key} className="hitl-form-row">
              <label className="hitl-form-label" title={field.description ?? undefined}>
                {field.label}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <FormFieldInput
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                  resolvedOptions={resolved ?? undefined}
                  ownerValues={form!.current_values}
                />
                {field.description && (
                  <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{field.description}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showRec && (recommendation || summary) && (
        <div className="approval-rec">{recommendation ?? summary}</div>
      )}

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
          placeholder={requireNote ? 'Required' : 'Optional context for the audit trail'}
        />
      </div>

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

// ── Step 2: Final Approval ────────────────────────────────────────────────────

function Step2({ job, intervention, onAction, loading }: Omit<Props, 'subtype'>) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const form = getFormData(intervention)
  const msg = intervention.interrupt_message
  const stepIndex = msg?.step_index ?? 2
  const totalSteps = msg?.total_steps ?? 3
  const actionItems = getActionItems(intervention)

  const cv = form?.current_values ?? {}
  const carrierName = cv.carrier as string | undefined
  const grandTotal = cv.grand_total as number | null | undefined
  const currencyCode = (cv.currency_code as string) ?? 'USD'

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="purple" dot={false}>Final Approval</Badge>
            </span>
            <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--gray-500)', fontWeight: 400 }}>
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
          <div className="approval-sub">
            {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
          <button
            onClick={() => navigate(`/pipeline/${job.id}/quote/confirm`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Details →
          </button>
        </div>
      </div>

      {msg?.context?.summary && (
        <div className="approval-rec">{msg.context.summary}</div>
      )}

      {/* Read-only summary of key fields */}
      <div className="hitl-form">
        {(form?.schema ?? []).slice(0, 6).map((field) => {
          const value = cv[field.key]
          return (
            <div key={field.key} className="hitl-form-row">
              <label className="hitl-form-label">{field.label}</label>
              <span className="hitl-form-static">{value != null ? String(value) : '—'}</span>
            </div>
          )
        })}
        {/* Fallback for approval type with no form schema */}
        {(!form?.schema || form.schema.length === 0) && Object.entries(cv).slice(0, 6).map(([key, value]) => (
          <div key={key} className="hitl-form-row">
            <label className="hitl-form-label">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
            <span className="hitl-form-static">{value != null ? String(value) : '—'}</span>
          </div>
        ))}
        {grandTotal != null && (
          <div className="hitl-form-row" style={{ fontWeight: 700, borderTop: '2px solid var(--gray-200)', paddingTop: 8, marginTop: 4 }}>
            <label className="hitl-form-label">Grand Total</label>
            <span style={{ color: 'var(--primary, #1d4ed8)' }}>{currencyCode} {grandTotal.toLocaleString()}</span>
          </div>
        )}
      </div>

      <ActionButtons
        actions={actionItems}
        loading={loading}
        buildBody={(item) => ({ action: item.id })}
        onSubmit={onAction}
      />
    </div>
  )
}

// ── Router ─────────────────────────────────────────────────────────────────────

export function Type2Card({ job, intervention, subtype, onAction, loading }: Props) {
  if (subtype === 'type2_step0') {
    return <Step0 job={job} intervention={intervention} onAction={onAction} loading={loading} />
  }
  if (subtype === 'type2_step2') {
    return <Step2 job={job} intervention={intervention} onAction={onAction} loading={loading} />
  }
  return <Step1 job={job} intervention={intervention} onAction={onAction} loading={loading} />
}
