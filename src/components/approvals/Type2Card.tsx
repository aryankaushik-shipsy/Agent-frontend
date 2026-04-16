import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getTierInfo, getCustomerName } from '../../utils/status'
import { getActionItems, getCandidateData, getFormData } from '../../utils/hitl'
import { isAboveThreshold } from '../../utils/margin'
import { TIER_MINIMUMS } from '../../constants'
import { ActionButtons } from './ActionButtons'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'
import type { CandidateOption } from '../../types/hitl'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const msg = intervention.interrupt_message
  const stepIndex = msg?.step_index ?? 0
  const totalSteps = msg?.total_steps ?? 2
  const actionItems = getActionItems(intervention)

  if (!candidateData) return null

  const { options, id_field } = candidateData

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Select Carrier</Badge>
            </span>
            <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--gray-500)', fontWeight: 400 }}>
              Step {stepIndex + 1} of {totalSteps}
            </span>
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

      {msg?.context?.recommendation && (
        <div className="approval-rec">{msg.context.recommendation}</div>
      )}

      <div className="carrier-option-grid">
        {options.map((carrier: CandidateOption) => {
          const id = String(carrier[id_field as keyof CandidateOption] ?? '')
          const isSelected = selectedId === id
          const hasDiscount = carrier.discount != null
          const aboveThreshold = isAboveThreshold(carrier.grand_total)

          return (
            <button
              key={id}
              className={`carrier-option-card${isSelected ? ' carrier-option-card--selected' : ''}`}
              onClick={() => setSelectedId(id)}
            >
              <div className="carrier-option-name">
                {carrier.carrier}
                {aboveThreshold && (
                  <span style={{ marginLeft: 6 }}>
                    <Badge variant="red" dot={false}>Above $5K</Badge>
                  </span>
                )}
              </div>

              {hasDiscount && carrier.discount ? (
                <div className="carrier-option-price">
                  <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', fontSize: 13 }}>
                    {carrier.currency_code} {carrier.discount.original_grand_total?.toLocaleString() ?? carrier.grand_total?.toLocaleString()}
                  </span>
                  <span style={{ color: '#dc2626', fontSize: 12 }}>
                    −{carrier.discount.discount_pct?.toFixed(1)}%
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {carrier.currency_code} {carrier.discount.adjusted_grand_total?.toLocaleString()}
                  </span>
                </div>
              ) : (
                <div className="carrier-option-price" style={{ fontWeight: 700, fontSize: 15 }}>
                  {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
                </div>
              )}

              <div className="carrier-option-meta">
                <span>Transit: {carrier.transit_days != null ? `${carrier.transit_days}d` : '—'}</span>
                <span>Valid: {carrier.validity_date ? formatDate(carrier.validity_date) : '—'}</span>
              </div>
            </button>
          )
        })}
      </div>

      <ActionButtons
        actions={actionItems}
        loading={loading}
        disabled={() => !selectedId}
        buildBody={(item) => ({
          action: item.id,
          selected_candidate_id: selectedId ?? '',
        })}
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
  const tierInfo = getTierInfo(job)
  const tier = tierInfo?.tierLabel ?? '—'
  const tierMin = TIER_MINIMUMS[tier] ?? 5
  const msg = intervention.interrupt_message
  const stepIndex = msg?.step_index ?? 1
  const totalSteps = msg?.total_steps ?? 2

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
      if (values[field.key] !== form!.current_values[field.key]) {
        edits[field.key] = values[field.key]
      }
    }
    return edits
  }

  const carrierName = values.carrier as string | undefined
  const grandTotal = values.grand_total as number | null | undefined

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Review Pricing</Badge>
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

      <div className="approval-meta">
        <div className="approval-meta-item">
          <span className="approval-meta-label">Customer Tier</span>
          <span className="approval-meta-value">{tier} (min {tierMin}%)</span>
        </div>
        {grandTotal != null && isAboveThreshold(grandTotal) && (
          <div className="approval-meta-item">
            <span className="approval-meta-label">Flag</span>
            <span className="approval-meta-value">
              <Badge variant="red" dot={false}>Above $5K</Badge>
            </span>
          </div>
        )}
      </div>

      <div className="hitl-form">
        {form.schema.map((field) => {
          const value = values[field.key]

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
        })}
      </div>

      <ActionButtons
        actions={getActionItems(intervention)}
        loading={loading}
        buildBody={(item) => ({ action: item.id, edited_values: computeEdits() })}
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
