import { useParams, useNavigate } from 'react-router-dom'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { getPendingIntervention, getFormData, detectHitlSubtype } from '../utils/hitl'
import { getCustomerName, getTierFromTasks } from '../utils/status'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { formatDate } from '../utils/time'

export function QuoteConfirm() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync, isPending } = useHitlAction()

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="lg" /></div>
  }
  if (!job) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  const pending = getPendingIntervention(job.interventions)
  const form = pending ? getFormData(pending) : null
  const msg = pending?.interrupt_message
  const subtype = pending ? detectHitlSubtype(pending) : null

  if (!pending || (subtype !== 'type2_step2' && pending.current_step !== 2)) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in the Final Approval stage.</div>
      </div>
    )
  }

  const stepIndex = msg?.step_index ?? 2
  const totalSteps = msg?.total_steps ?? 3
  const actionId = msg?.actions?.[0]?.id ?? 'approved'
  const customer = getCustomerName(job)
  const tier = getTierFromTasks(job)
  const cv = form?.current_values ?? {}

  // Prior edits from earlier steps (audit trail)
  const priorEdits = (msg as unknown as Record<string, unknown>)?.prior_edits as
    | Array<{ step_index: number; step_name: string; action: string; edits?: Record<string, unknown> }> | null

  async function handleApprove() {
    await mutateAsync({ id: pending!.id, action: actionId })
    navigate('/pipeline')
  }

  async function handleReject() {
    await mutateAsync({ id: pending!.id, action: 'end' })
    navigate('/pipeline')
  }

  // Group fields into categories for display
  const carrierName = cv.carrier as string | undefined
  const grandTotal = cv.grand_total as number | undefined
  const currencyCode = (cv.currency_code as string) ?? 'USD'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-600)',
          }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Final Approval
            <span style={{ marginLeft: 8 }}>
              <Badge variant="purple" dot={false}>Step {stepIndex + 1} of {totalSteps}</Badge>
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            #RFQ-{job.id} · {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
      </div>

      {/* Context summary */}
      {msg?.context?.summary && (
        <div className="banner banner-blue" style={{ marginBottom: 20 }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <div className="banner-content">{msg.context.summary}</div>
        </div>
      )}

      {/* All current values as read-only review */}
      <div className="card card-body" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', padding: '16px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quote Summary — Review All Details
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Render form fields as read-only (if schema available) */}
          {(form?.schema ?? []).map((field) => {
            const value = cv[field.key]
            const wasEdited = priorEdits?.some((e) => e.edits && field.key in e.edits)

            return (
              <div key={field.key} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                fontSize: 13, borderBottom: '1px solid var(--gray-50)',
              }}>
                <span style={{ color: 'var(--gray-500)' }}>{field.label}</span>
                <span style={{ fontWeight: wasEdited ? 600 : 400, color: wasEdited ? '#2563eb' : undefined }}>
                  {value != null ? String(value) : '—'}
                  {wasEdited && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#2563eb', fontWeight: 500 }}>edited</span>
                  )}
                </span>
              </div>
            )
          })}

          {/* If no schema (e.g. approval type), show raw current_values */}
          {(!form?.schema || form.schema.length === 0) && Object.entries(cv).map(([key, value]) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              fontSize: 13, borderBottom: '1px solid var(--gray-50)',
            }}>
              <span style={{ color: 'var(--gray-500)' }}>{formatLabel(key)}</span>
              <span>{value != null ? String(value) : '—'}</span>
            </div>
          ))}

          {/* Grand total highlight */}
          {grandTotal != null && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--gray-200)',
              fontWeight: 700, fontSize: 16,
            }}>
              <span>Grand Total</span>
              <span style={{ color: 'var(--primary, #1d4ed8)' }}>
                {currencyCode} {grandTotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Prior edits audit trail */}
      {priorEdits && priorEdits.length > 0 && (
        <div className="card card-body" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Changes Made
          </div>
          {priorEdits.map((edit, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--gray-50)' }}>
              <span style={{ fontWeight: 500 }}>{formatLabel(edit.step_name)}</span>
              <span style={{ color: 'var(--gray-400)', marginLeft: 8 }}>({edit.action})</span>
              {edit.edits && Object.keys(edit.edits).length > 0 && (
                <div style={{ marginTop: 4, paddingLeft: 12 }}>
                  {Object.entries(edit.edits).map(([key, val]) => (
                    <div key={key} style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                      {formatLabel(key)}: <strong>{String(val)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button variant="red-outline" disabled={isPending} onClick={handleReject}>
          Reject
        </Button>
        <Button variant="green" loading={isPending} onClick={handleApprove}>
          Approve & Continue
        </Button>
      </div>
    </div>
  )
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
