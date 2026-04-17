import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHitlAction } from '../hooks/useHitlAction'
import { getActionItems, getPendingIntervention, getFormData, detectHitlSubtype, formatFieldValue } from '../utils/hitl'
import { getJobById } from '../api/jobs'
import { getTierInfo, getCustomerName } from '../utils/status'
import { isAboveThreshold } from '../utils/margin'
import { TIER_MINIMUMS } from '../constants'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { ActionButtons } from '../components/approvals/ActionButtons'
import type { JobDetail } from '../types/job'
import type { InterruptActionItem, InterruptConstraints } from '../types/hitl'
import type { HITLActionRequest } from '../api/hitl'

const POLL_INTERVAL_MS = 3_000
const MAX_WAIT_MS      = 60_000

export function QuoteEditForm() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useHitlAction()
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [waitingTimedOut, setWaitingTimedOut] = useState(false)

  // Poll for Step 1 on mount — the previous step's submission may still be
  // processing when the user lands on this page.
  const [job, setJob]             = useState<JobDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [initialTimedOut, setInitialTimedOut] = useState(false)
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
        const ready = pending && detectHitlSubtype(pending) === 'type2_step1'

        if (ready) {
          if (tickRef.current) clearInterval(tickRef.current)
          setJob(data)
          return
        }

        if (Date.now() - startedAt.current >= MAX_WAIT_MS) {
          if (tickRef.current) clearInterval(tickRef.current)
          setJob(data)
          setInitialTimedOut(true)
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

  // Still polling for Step 1
  if (!job && !loadError) {
    const pct = Math.min(100, Math.round((elapsed / 45) * 100))
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 420, gap: 20, padding: '0 24px',
      }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 700, fontSize: 18 }}>Preparing pricing review…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          The agent is calculating pricing for the selected carrier. This usually takes 20–30 seconds.
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

  if (initialTimedOut || !pending || !form || detectHitlSubtype(pending) !== 'type2_step1') {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">
          The pricing review step hasn't appeared yet. Check the pipeline — it may arrive shortly.
        </div>
      </div>
    )
  }

  const stepIndex = msg?.step_index ?? 1
  const totalSteps = msg?.total_steps ?? 1
  const actionItems = getActionItems(pending)
  const customer = getCustomerName(job!)
  const tierInfo = getTierInfo(job!)
  const tier = tierInfo?.tierLabel ?? '—'
  const tierMin = TIER_MINIMUMS[tier] ?? 5
  const title = msg?.title ?? 'Review Pricing'
  const description = msg?.description
  const summary = msg?.context?.summary
  const recommendation = msg?.context?.recommendation
  const constraints = msg?.constraints ?? {}

  return (
    <QuoteEditFormInner
      job={job!}
      interventionId={pending.id}
      form={form}
      title={title}
      description={description}
      summary={summary}
      recommendation={recommendation}
      constraints={constraints}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      actionItems={actionItems}
      customer={customer}
      tier={tier}
      tierMin={tierMin}
      mutateAsync={mutateAsync}
      isPending={isPending}
      navigate={navigate}
      jobId={jobId!}
      waitingForNext={waitingForNext}
      setWaitingForNext={setWaitingForNext}
      waitingTimedOut={waitingTimedOut}
      setWaitingTimedOut={setWaitingTimedOut}
    />
  )
}

// Inner component so hooks aren't called conditionally
function QuoteEditFormInner({
  job, interventionId, form, title, description, summary, recommendation, constraints,
  stepIndex, totalSteps, actionItems,
  customer, tier, tierMin, mutateAsync, isPending, navigate, jobId,
  waitingForNext, setWaitingForNext, waitingTimedOut, setWaitingTimedOut,
}: {
  job: import('../types/job').JobDetail
  interventionId: number
  form: import('../types/hitl').FormData
  title: string
  description?: string
  summary?: string
  recommendation?: string
  constraints: InterruptConstraints
  stepIndex: number
  totalSteps: number
  actionItems: InterruptActionItem[]
  customer: string
  tier: string
  tierMin: number
  mutateAsync: ReturnType<typeof import('../hooks/useHitlAction').useHitlAction>['mutateAsync']
  isPending: boolean
  navigate: ReturnType<typeof import('react-router-dom').useNavigate>
  jobId: string
  waitingForNext: boolean
  setWaitingForNext: (v: boolean) => void
  waitingTimedOut: boolean
  setWaitingTimedOut: (v: boolean) => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => ({ ...(form.current_values ?? {}) })
  )
  const [note, setNote] = useState('')

  const showRec        = constraints.show_ai_recommendation !== false
  const noteLabel      = constraints.note_label ?? 'Note (optional)'
  const requireNote    = constraints.require_note === true
  const noteMaxLength  = constraints.note_max_length ?? undefined

  function handleChange(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function computeEdits(): Record<string, unknown> {
    const edits: Record<string, unknown> = {}
    for (const field of form.schema) {
      if (!field.editable) continue
      if (values[field.key] !== form.current_values[field.key]) {
        edits[field.key] = values[field.key]
      }
    }
    return edits
  }

  function isDisabled(_item: InterruptActionItem): boolean {
    if (requireNote && note.trim().length === 0) return true
    return false
  }

  const carrierName = values.carrier as string | undefined
  const grandTotal = values.grand_total as number | null | undefined

  if (waitingForNext) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 600, fontSize: 16 }}>Processing changes…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
          The agent is recalculating pricing. This usually takes a few seconds.
        </div>
      </div>
    )
  }

  if (waitingTimedOut) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <div style={{ fontSize: 32 }}>⏱</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Taking longer than expected</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
          The next step hasn't appeared yet. Check the pipeline — it may arrive shortly.
        </div>
        <Button variant="primary" onClick={() => navigate('/pipeline')}>
          Go to Pipeline
        </Button>
      </div>
    )
  }

  async function submitAction(body: import('../api/hitl').HITLActionRequest) {
    await mutateAsync({ id: interventionId, ...body })
    setWaitingForNext(true)

    // Poll the same HITL record for step advancement to Step 2 (final approval),
    // or navigate to the pipeline if the record completed (e.g. the user picked "end").
    const jobIdNum = parseInt(jobId)
    let attempts = 0
    const MAX = 15

    const poll = async () => {
      attempts++
      try {
        const freshJob = await getJobById(jobIdNum)
        const next = getPendingIntervention(freshJob.interventions)
        if (!next) {
          navigate('/pipeline')
          return
        }
        if (next.action_taken == null) {
          const subtype = detectHitlSubtype(next)
          if (subtype === 'type2_step2' || next.current_step === 2) {
            navigate(`/pipeline/${jobIdNum}/quote/confirm`)
            return
          }
          if (subtype === 'type3') {
            navigate(`/pipeline/${jobIdNum}/email-preview`)
            return
          }
        }
      } catch {
        // network hiccup — keep trying
      }
      if (attempts < MAX) {
        setTimeout(poll, 3_000)
      } else {
        setWaitingForNext(false)
        setWaitingTimedOut(true)
      }
    }

    setTimeout(poll, 2_000)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header — title comes from interrupt.title */}
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
                <Badge variant="yellow" dot={false}>Step {stepIndex + 1} of {totalSteps}</Badge>
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            #RFQ-{job.id} · {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
      </div>

      {/* Policy-authored reviewer guidance */}
      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 12, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      {/* Org business-rule context chips (not part of the policy payload) */}
      <div className="approval-meta" style={{ marginBottom: 20 }}>
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

      {/* Form — rendered strictly from form.schema */}
      <div className="card card-body">
        <div className="hitl-form">
          {form.schema.map((field) => {
            const value = values[field.key]

            if (!field.editable) {
              return (
                <div key={field.key} className="hitl-form-row">
                  <label className="hitl-form-label">{field.label}</label>
                  <span className="hitl-form-static">
                    {formatFieldValue(field.key, value, form.current_values)}
                  </span>
                </div>
              )
            }

            if (field.type === 'select' && field.options?.length) {
              return (
                <div key={field.key} className="hitl-form-row">
                  <label className="hitl-form-label">{field.label}</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <select
                      className="hitl-form-input"
                      value={value != null ? String(value) : ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    >
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {field.description && (
                      <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{field.description}</span>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    className="hitl-form-input"
                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    min={field.type === 'number' ? (field.min ?? undefined) : undefined}
                    max={field.type === 'number' ? (field.max ?? undefined) : undefined}
                    value={value != null ? String(value) : ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      handleChange(field.key, raw === '' ? null : (field.type === 'number' ? Number(raw) : raw))
                    }}
                  />
                  {field.description && (
                    <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{field.description}</span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Policy-driven note input — label & limits come from constraints */}
          <div className="hitl-form-row" style={{ marginTop: 6 }}>
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
      </div>

      {showRec && (recommendation || summary) && (
        <div className="approval-rec" style={{ marginTop: 16 }}>{recommendation ?? summary}</div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <ActionButtons
          actions={actionItems}
          loading={isPending}
          disabled={isDisabled}
          buildBody={(item) => {
            const body: HITLActionRequest = { action: item.id }
            const edits = computeEdits()
            if (Object.keys(edits).length > 0) body.edited_values = edits
            const trimmed = note.trim()
            if (trimmed) body.note = trimmed
            return body
          }}
          onSubmit={submitAction}
        />
      </div>
    </div>
  )
}
