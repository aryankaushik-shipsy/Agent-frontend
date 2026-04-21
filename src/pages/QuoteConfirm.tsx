import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHitlAction } from '../hooks/useHitlAction'
import { getActionItems, getPendingIntervention, getFormData, detectHitlSubtype, formatFieldValue, humanizeKey } from '../utils/hitl'
import { buildActionBody } from '../utils/buildActionBody'
import { getCustomerName } from '../utils/status'
import { getJobById } from '../api/jobs'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { ActionButtons } from '../components/approvals/ActionButtons'
import type { JobDetail } from '../types/job'
import type { HITLActionRequest } from '../api/hitl'
import type { InterruptActionItem, InterruptConstraints, PriorEditEntry } from '../types/hitl'

const POLL_INTERVAL_MS = 3_000
const MAX_WAIT_MS      = 60_000

export function QuoteConfirm() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useHitlAction()

  // Polling state — mirrors EmailPreview so the user sees a 30–60s spinner
  // while the backend transitions from Step 1 → Step 2 rather than a bare
  // "not in Final Approval" banner.
  const [job, setJob]             = useState<JobDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [timedOut, setTimedOut]   = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const startedAt = useRef(Date.now())
  const pollRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted   = useRef(true)

  useEffect(() => {
    mounted.current = true
    startedAt.current = Date.now()
    setElapsed(0)

    tickRef.current = setInterval(() => {
      if (mounted.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)

    async function attempt() {
      if (!mounted.current) return
      const jobIdNum = jobId ? parseInt(jobId) : null
      if (!jobIdNum) { setLoadError(true); return }

      try {
        const data = await getJobById(jobIdNum)
        if (!mounted.current) return

        const pending = getPendingIntervention(data.interventions)
        const subtype = pending ? detectHitlSubtype(pending) : null
        const ready = pending && (subtype === 'type2_step2' || pending.current_step === 2)

        if (ready) {
          if (tickRef.current) clearInterval(tickRef.current)
          setJob(data)
          return
        }

        if (Date.now() - startedAt.current >= MAX_WAIT_MS) {
          if (tickRef.current) clearInterval(tickRef.current)
          setJob(data)
          setTimedOut(true)
          return
        }

        pollRef.current = setTimeout(attempt, POLL_INTERVAL_MS)
      } catch {
        if (!mounted.current) return
        if (Date.now() - startedAt.current >= MAX_WAIT_MS) {
          if (tickRef.current) clearInterval(tickRef.current)
          setLoadError(true)
          return
        }
        pollRef.current = setTimeout(attempt, POLL_INTERVAL_MS)
      }
    }

    attempt()

    return () => {
      mounted.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [jobId])

  // Still waiting
  if (!job && !loadError) {
    const pct = Math.min(100, Math.round((elapsed / 45) * 100))
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 420, gap: 20, padding: '0 24px',
      }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 700, fontSize: 18 }}>Preparing final approval…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          The agent is assembling the final quote for your review. This usually takes 20–30 seconds.
        </div>
        <div style={{ width: 320, height: 6, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, background: '#2563eb',
            borderRadius: 99, transition: 'width 1s linear',
          }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
          {elapsed}s elapsed · checking every {POLL_INTERVAL_MS / 1000}s
        </div>
      </div>
    )
  }

  if (loadError) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  const pending = getPendingIntervention(job!.interventions)
  const form = pending ? getFormData(pending) : null
  const msg = pending?.interrupt_message
  const subtype = pending ? detectHitlSubtype(pending) : null

  if (timedOut || !pending || (subtype !== 'type2_step2' && pending.current_step !== 2)) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="banner banner-yellow">
          <div className="banner-content">
            The final approval step hasn't appeared yet. Check the pipeline — it may arrive shortly.
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={() => navigate('/pipeline')}>Go to Pipeline</Button>
        </div>
      </div>
    )
  }

  const ctx = msg?.context ?? {}
  const constraints: InterruptConstraints = msg?.constraints ?? {}
  const actionItems = getActionItems(pending)
  const customer = getCustomerName(job!)
  const cv = form?.current_values ?? {}
  const priorEdits: PriorEditEntry[] = (msg?.prior_edits ?? []) as PriorEditEntry[]

  const title       = msg?.title ?? 'Final Approval'
  const description = msg?.description
  const summary     = ctx.summary
  const recommendation = ctx.recommendation
  const showRec     = constraints.show_ai_recommendation !== false

  const noteLabel     = constraints.note_label ?? 'Note (optional)'
  const requireNote   = constraints.require_note === true
  const noteMaxLength = constraints.note_max_length ?? undefined

  const stepIndex  = msg?.step_index ?? 2
  const totalSteps = msg?.total_steps ?? 3

  const carrierName = cv.carrier as string | undefined
  const grandTotal  = cv.grand_total as number | undefined
  const currencyCode = (cv.currency_code as string) ?? 'USD'

  // Per-field "was edited" lookup derived from prior_edits. Supports both
  // payload shapes:
  //  V2: {step_index, field, old_value, new_value} — one entry per edited field
  //  V1: {step_index, action_id, step_name, old_value, new_value} where
  //      old/new are Record<string, unknown> grouped per step.
  const editedFieldKeys = new Set<string>()
  for (const p of priorEdits) {
    if (p.field) {
      // V2 — a single field entry; include if old/new differ
      if (p.old_value !== p.new_value) editedFieldKeys.add(p.field)
      continue
    }
    // V1 fallback
    const oldV = (p.old_value ?? {}) as Record<string, unknown>
    const newV = (p.new_value ?? {}) as Record<string, unknown>
    for (const k of Object.keys(newV)) {
      if (oldV[k] !== newV[k]) editedFieldKeys.add(k)
    }
  }

  return (
    <QuoteConfirmInner
      job={job!}
      pending={pending}
      form={form}
      title={title}
      description={description}
      summary={summary}
      recommendation={recommendation}
      showRec={showRec}
      noteLabel={noteLabel}
      requireNote={requireNote}
      noteMaxLength={noteMaxLength}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      customer={customer}
      carrierName={carrierName}
      grandTotal={grandTotal}
      currencyCode={currencyCode}
      cv={cv}
      priorEdits={priorEdits}
      editedFieldKeys={editedFieldKeys}
      actionItems={actionItems}
      isPending={isPending}
      mutateAsync={mutateAsync}
      navigate={navigate}
    />
  )
}

// Inner component so state hooks aren't called conditionally
function QuoteConfirmInner({
  job, pending, form,
  title, description, summary, recommendation, showRec,
  noteLabel, requireNote, noteMaxLength,
  stepIndex, totalSteps,
  customer, carrierName, grandTotal, currencyCode, cv,
  priorEdits, editedFieldKeys,
  actionItems, isPending, mutateAsync, navigate,
}: {
  job: JobDetail
  pending: import('../types/job').Intervention
  form: import('../types/hitl').FormData | null
  title: string
  description?: string
  summary?: string
  recommendation?: string
  showRec: boolean
  noteLabel: string
  requireNote: boolean
  noteMaxLength?: number
  stepIndex: number
  totalSteps: number
  customer: string
  carrierName?: string
  grandTotal?: number
  currencyCode: string
  cv: Record<string, unknown>
  priorEdits: PriorEditEntry[]
  editedFieldKeys: Set<string>
  actionItems: InterruptActionItem[]
  isPending: boolean
  mutateAsync: ReturnType<typeof useHitlAction>['mutateAsync']
  navigate: ReturnType<typeof import('react-router-dom').useNavigate>
}) {
  const [note, setNote] = useState('')

  async function submitAction(body: HITLActionRequest) {
    await mutateAsync({ id: pending.id, ...body })
    navigate('/pipeline')
  }

  function buildBody(item: InterruptActionItem): HITLActionRequest {
    // Step 2 form is read-only, but the policy may still declare a note leaf
    // (free_text) inside the form tree. buildActionBody routes that + the
    // top-level reviewer note correctly.
    if (form?.sections) {
      return buildActionBody({
        sections: form.sections,
        values: form.current_values ?? {},
        note,
        clickedAction: item,
      })
    }
    const body: HITLActionRequest = { action: item.id }
    const trimmed = note.trim()
    if (trimmed) body.note = trimmed
    return body
  }

  function isDisabled(_item: InterruptActionItem): boolean {
    if (requireNote && note.trim().length === 0) return true
    return false
  }

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
            {title}
            {totalSteps > 1 && (
              <span style={{ marginLeft: 8 }}>
                <Badge variant="purple" dot={false}>Step {stepIndex + 1} of {totalSteps}</Badge>
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            #RFQ-{job.id} · {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
      </div>

      {description && (
        <div className="banner banner-blue" style={{ marginBottom: 20 }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <div className="banner-content">{description}</div>
        </div>
      )}

      {showRec && (recommendation || summary) && (
        <div className="approval-rec" style={{ marginBottom: 16 }}>{recommendation ?? summary}</div>
      )}

      {/* All current values as read-only review — policy-schema-driven */}
      <div className="card card-body" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', padding: '16px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quote Summary — Review All Details
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {(form?.schema ?? []).map((field) => {
            const value = cv[field.key]
            const wasEdited = editedFieldKeys.has(field.key)

            return (
              <div key={field.key} style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                fontSize: 13, borderBottom: '1px solid var(--gray-50)',
              }}>
                <span style={{ color: 'var(--gray-500)' }}>{field.label}</span>
                <span style={{ fontWeight: wasEdited ? 600 : 400, color: wasEdited ? '#2563eb' : undefined }}>
                  {formatFieldValue(field.key, value, cv)}
                  {wasEdited && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#2563eb', fontWeight: 500 }}>edited</span>
                  )}
                </span>
              </div>
            )
          })}

          {/* If no schema, show raw current_values */}
          {(!form?.schema || form.schema.length === 0) && Object.entries(cv).map(([key, value]) => (
            <div key={key} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              fontSize: 13, borderBottom: '1px solid var(--gray-50)',
            }}>
              <span style={{ color: 'var(--gray-500)' }}>{humanizeKey(key)}</span>
              <span>{formatFieldValue(key, value, cv)}</span>
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

      {/* Changes Made — rendered from prior_edits' old_value → new_value diff */}
      {priorEdits.length > 0 && (
        <div className="card card-body" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Changes Made
          </div>
          {(() => {
            // V2 entries are per-field; V1 entries are per-step with nested
            // old/new records. Group V2 by step_index so the UI still reads
            // "Step N: field1 old → new, field2 old → new" instead of a flat
            // list.
            type V2GroupKey = string
            const v2Groups = new Map<V2GroupKey, Array<{ field: string; old_value: unknown; new_value: unknown; step_index: number }>>()
            const v1Entries: typeof priorEdits = []
            for (const p of priorEdits) {
              if (p.field) {
                const k = String(p.step_index)
                if (!v2Groups.has(k)) v2Groups.set(k, [])
                v2Groups.get(k)!.push({
                  field: p.field,
                  old_value: p.old_value,
                  new_value: p.new_value,
                  step_index: p.step_index,
                })
              } else {
                v1Entries.push(p)
              }
            }

            const rows: React.ReactNode[] = []

            // V2 rendering — grouped per step
            for (const [k, entries] of v2Groups) {
              const stepIx = entries[0].step_index
              rows.push(
                <div key={`v2-${k}`} style={{ fontSize: 13, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>Step {stepIx + 1}</span>
                  </div>
                  <div style={{ marginTop: 4, paddingLeft: 12 }}>
                    {entries.map((e) => (
                      <div key={e.field} style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                        {humanizeKey(e.field)}:{' '}
                        <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: 4 }}>
                          {formatFieldValue(e.field, e.old_value)}
                        </span>
                        →{' '}
                        <strong>{formatFieldValue(e.field, e.new_value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            // V1 rendering — per-step entries with record-shaped old/new
            for (let i = 0; i < v1Entries.length; i++) {
              const edit = v1Entries[i]
              const oldV = (edit.old_value ?? {}) as Record<string, unknown>
              const newV = (edit.new_value ?? {}) as Record<string, unknown>
              const diffKeys = Object.keys(newV).filter((kk) => oldV[kk] !== newV[kk])
              rows.push(
                <div key={`v1-${i}`} style={{ fontSize: 13, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{humanizeKey(edit.step_name ?? `Step ${edit.step_index + 1}`)}</span>
                    {edit.action_id && <span style={{ color: 'var(--gray-400)', marginLeft: 8 }}>({edit.action_id})</span>}
                  </div>
                  {diffKeys.length > 0 ? (
                    <div style={{ marginTop: 4, paddingLeft: 12 }}>
                      {diffKeys.map((key) => (
                        <div key={key} style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                          {humanizeKey(key)}:{' '}
                          <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: 4 }}>
                            {formatFieldValue(key, oldV[key], oldV)}
                          </span>
                          →{' '}
                          <strong>{formatFieldValue(key, newV[key], newV)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 4, paddingLeft: 12, fontSize: 12, color: 'var(--gray-400)' }}>
                      No field edits at this step.
                    </div>
                  )}
                </div>
              )
            }
            return rows
          })()}
        </div>
      )}

      {/* Policy-driven note input */}
      <div className="card card-body" style={{ marginTop: 16 }}>
        <div className="hitl-form-row">
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
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <ActionButtons
          actions={actionItems}
          loading={isPending}
          disabled={isDisabled}
          buildBody={buildBody}
          onSubmit={submitAction}
        />
      </div>
    </div>
  )
}
