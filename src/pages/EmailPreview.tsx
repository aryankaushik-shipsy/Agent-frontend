import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useHitlAction } from '../hooks/useHitlAction'
import { getPendingIntervention, detectHitlSubtype, getActionItems, getToolArgsData } from '../utils/hitl'
import { getCustomerName, getInfoField, isPlatformJob } from '../utils/status'
import { getJobById } from '../api/jobs'
import { Spinner } from '../components/ui/Spinner'
import { ActionButtons } from '../components/approvals/ActionButtons'
import type { JobDetail } from '../types/job'
import type { HITLActionRequest } from '../api/hitl'

const POLL_INTERVAL_MS = 5_000   // poll every 5 s
const MAX_WAIT_MS      = 60_000  // give up after 60 s

export function EmailPreview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useHitlAction()
  const queryClient = useQueryClient()

  const [job,       setJob]       = useState<JobDetail | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [timedOut,  setTimedOut]  = useState(false)
  const [elapsed,   setElapsed]   = useState(0)   // seconds shown in UI
  // Editable tool_args — the policy decides which keys are exposed. Local
  // edits are keyed by arg name and compared against the original values to
  // compute `edited_values` on submit.
  const [argEdits, setArgEdits] = useState<Record<string, unknown>>({})
  const [editMode, setEditMode] = useState(false)

  const startedAt  = useRef(Date.now())
  const pollRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const mounted    = useRef(true)

  useEffect(() => {
    mounted.current  = true
    startedAt.current = Date.now()
    setElapsed(0)

    // Tick every second so the "Xs…" counter updates
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
        const hasEmailAction =
          getActionItems(pending).some((a) => a.id === 'approved' || a.id === 'send_email') ||
          (pending?.interrupt?.actions?.some((a) => a.id === 'send_email') ?? false)
        const ready = pending && (subtype === 'type3' || hasEmailAction)

        if (ready) {
          if (tickRef.current) clearInterval(tickRef.current)
          setJob(data)
          return
        }

        // Not ready — exceeded max wait?
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

  // Still waiting — show persistent loading screen
  if (!job && !loadError) {
    const pct = Math.min(100, Math.round((elapsed / 45) * 100)) // fill bar over ~45 s
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 420, gap: 20, padding: '0 24px',
      }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 700, fontSize: 18 }}>Generating email preview…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          The agent is preparing your quote email. This usually takes 20–30 seconds.
        </div>

        {/* Progress bar */}
        <div style={{ width: 320, height: 6, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, background: '#2563eb',
            borderRadius: 99, transition: 'width 1s linear',
          }} />
        </div>

        <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
          {elapsed}s elapsed · checking every 5s
        </div>
      </div>
    )
  }



  if (loadError) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  if (!job) return null

  const pending = getPendingIntervention(job.interventions)
  const subtype = pending ? detectHitlSubtype(pending) : null

  if (timedOut || !pending || subtype !== 'type3') {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in Email Preview stage.</div>
      </div>
    )
  }

  // All editable tool args come from the policy via the interrupt payload.
  // Dashboard doesn't assume any particular key name (e.g. subject/message) —
  // the policy might declare different keys for different tools.
  const toolArgs = getToolArgsData(pending)
  const originalArgs = toolArgs?.args ?? {}
  const uiSchema = toolArgs?.ui_schema ?? {}
  const argKeys = Object.keys(originalArgs)
  const getVal = (k: string) => (k in argEdits ? argEdits[k] : originalArgs[k])

  const summary =
    pending.interrupt_message?.context?.summary ??
    pending.interrupt?.details?.summary
  const platform  = isPlatformJob(job)
  const customer  = getCustomerName(job)
  // Show actual sender email in "To:" (stored as info label "address" by n8n)
  const recipient =
    getInfoField(job.info, 'address') ??
    getInfoField(job.info, 'Sender Email') ??
    job.input_json?.sender_email ??
    customer

  const actionItems = getActionItems(pending)

  async function handleSubmit(body: HITLActionRequest) {
    if (!pending) return
    await mutateAsync({ id: pending.id, ...body })
    // Action routing type determines post-submit navigation:
    //   goto  → tool runs, email sends → go to audit trail
    //   skip  → tool bypassed, workflow ends → go back to pipeline
    const item = actionItems.find((a) => a.id === body.action)
    if (item?.type === 'goto') {
      if (job!.ticket_id) {
        queryClient.invalidateQueries({ queryKey: ['thread', job!.ticket_id] })
      }
      navigate(`/audit/${job!.id}`)
    } else {
      navigate('/pipeline')
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="banner banner-purple" style={{ marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
        <div className="banner-content">
          <div className="banner-title">
            #RFQ-{job.id}{customer !== '—' ? ` · ${customer}` : ''}
          </div>
          {summary && <div style={{ marginTop: 2 }}>{summary}</div>}
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 16 }}>
        {platform ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            padding: '8px 12px', background: 'var(--gray-50)',
            borderRadius: 6, border: '1px solid var(--gray-100)',
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15, color: '#6366f1', flexShrink: 0 }}>
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 500 }}>
              Platform initiated — sent directly by the agent
            </span>
          </div>
        ) : (
          <div className="recipient-row">
            <span className="recipient-label">To:</span>
            <span className="recipient-value">{recipient}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ai-tag">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              AI Generated
            </span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              {editMode ? 'Editing — changes are sent with approval' : 'Preview — click Edit to make changes'}
            </span>
          </div>
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            {editMode ? 'Preview' : 'Edit'}
          </button>
        </div>

        {/* Render each editable tool arg from the policy's ui_schema. Non-HTML
            args are rendered as plain inputs; HTML args are shown as an iframe
            preview, swapped for a textarea when edit mode is on. */}
        {argKeys.map((key) => {
          const hint = uiSchema[key]
          const label = hint?.label ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          const isHtml = hint?.format === 'html'
          const value = getVal(key)
          const strVal = value != null ? String(value) : ''

          if (isHtml) {
            return editMode ? (
              <div key={key} style={{ marginBottom: 12 }}>
                <label className="hitl-form-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
                <textarea
                  className="hitl-form-input"
                  style={{ width: '100%', minHeight: 240, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  value={strVal}
                  onChange={(e) => setArgEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ) : (
              <div key={key} className="email-preview-box">
                <iframe
                  className="email-preview-iframe"
                  sandbox="allow-same-origin"
                  srcDoc={strVal}
                  title={label}
                />
              </div>
            )
          }

          const multiline = hint?.multiline === true
          return (
            <div key={key} className="hitl-form-row" style={{ marginBottom: 10 }}>
              <label className="hitl-form-label">{label}</label>
              {editMode ? (
                multiline ? (
                  <textarea
                    className="hitl-form-input"
                    style={{ width: '100%', minHeight: 80 }}
                    value={strVal}
                    onChange={(e) => setArgEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className="hitl-form-input"
                    type="text"
                    value={strVal}
                    onChange={(e) => setArgEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                )
              ) : (
                <span className="hitl-form-static">{strVal || '—'}</span>
              )}
            </div>
          )
        })}
      </div>

      {actionItems.length > 0 ? (
        <ActionButtons
          actions={actionItems}
          loading={isPending}
          buildBody={(item) => {
            // Per policy, only goto-typed actions forward edited tool args.
            // skip-typed actions bypass the tool entirely, so edits are dropped.
            if (item.type !== 'goto') return { action: item.id }
            const edits: Record<string, unknown> = {}
            for (const key of Object.keys(argEdits)) {
              if (argEdits[key] !== originalArgs[key]) edits[key] = argEdits[key]
            }
            return Object.keys(edits).length > 0
              ? { action: item.id, edited_values: edits }
              : { action: item.id }
          }}
          onSubmit={handleSubmit}
        />
      ) : (
        // Safety net for payloads that omit an actions array entirely.
        // The dashboard cannot invent policy-specific action ids, so this
        // just surfaces an error rather than guessing.
        <div className="banner banner-yellow">
          <div className="banner-content">No actions available for this intervention.</div>
        </div>
      )}
    </div>
  )
}
