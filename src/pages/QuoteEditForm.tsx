import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { getPendingIntervention, getFormData, detectHitlSubtype } from '../utils/hitl'
import { getJobById } from '../api/jobs'
import { getTierInfo, getCustomerName } from '../utils/status'
import { isAboveThreshold } from '../utils/margin'
import { TIER_MINIMUMS } from '../constants'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

export function QuoteEditForm() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync, isPending } = useHitlAction()
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [waitingTimedOut, setWaitingTimedOut] = useState(false)

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="lg" /></div>
  }
  if (!job) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  const pending = getPendingIntervention(job.interventions)
  const form = pending ? getFormData(pending) : null
  const msg = pending?.interrupt_message

  if (!pending || !form || detectHitlSubtype(pending) !== 'type2_step1') {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in the Price Review stage.</div>
      </div>
    )
  }

  const stepIndex = msg?.step_index ?? 1
  const totalSteps = msg?.total_steps ?? 3
  const actionId = msg?.actions?.[0]?.id ?? 'confirmed'
  const customer = getCustomerName(job)
  const tierInfo = getTierInfo(job)
  const tier = tierInfo?.tierLabel ?? '—'
  const tierMin = TIER_MINIMUMS[tier] ?? 5

  return (
    <QuoteEditFormInner
      job={job}
      interventionId={pending.id}
      form={form}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      actionId={actionId}
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
  job, interventionId, form, stepIndex, totalSteps, actionId,
  customer, tier, tierMin, mutateAsync, isPending, navigate, jobId,
  waitingForNext, setWaitingForNext, waitingTimedOut, setWaitingTimedOut,
}: {
  job: import('../types/job').JobDetail
  interventionId: number
  form: import('../types/hitl').FormData
  stepIndex: number
  totalSteps: number
  actionId: string
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

  async function handleSubmit() {
    await mutateAsync({ id: interventionId, action: actionId, edited_values: computeEdits() })
    setWaitingForNext(true)

    // Poll for step advancement to final approval (step 2)
    const jobIdNum = parseInt(jobId)
    let attempts = 0
    const MAX = 15

    const poll = async () => {
      attempts++
      try {
        const freshJob = await getJobById(jobIdNum)
        const next = getPendingIntervention(freshJob.interventions)
        if (next && detectHitlSubtype(next) === 'type2_step2') {
          navigate(`/pipeline/${jobIdNum}/quote/confirm`)
          return
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
            Review Pricing
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Step {stepIndex + 1} of {totalSteps}</Badge>
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            #RFQ-{job.id} · {customer}{carrierName ? ` · ${carrierName}` : ''}
          </div>
        </div>
      </div>

      {/* Context */}
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

      {/* Form */}
      <div className="card card-body">
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

            if (field.type === 'select' && field.options?.length) {
              return (
                <div key={field.key} className="hitl-form-row">
                  <label className="hitl-form-label">{field.label}</label>
                  <select
                    className="hitl-form-input"
                    value={value != null ? String(value) : ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )
            }

            return (
              <div key={field.key} className="hitl-form-row">
                <label className="hitl-form-label">{field.label}</label>
                <input
                  className="hitl-form-input"
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={value != null ? String(value) : ''}
                  onChange={(e) => {
                    const raw = e.target.value
                    handleChange(field.key, raw === '' ? null : (field.type === 'number' ? Number(raw) : raw))
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button
          variant="red-outline"
          disabled={isPending}
          onClick={async () => {
            await mutateAsync({ id: interventionId, action: 'end' })
            navigate('/pipeline')
          }}
        >
          Manual Resolution
        </Button>
        <Button variant="green" loading={isPending} onClick={handleSubmit}>
          Confirm & Generate Quotation
        </Button>
      </div>
    </div>
  )
}
