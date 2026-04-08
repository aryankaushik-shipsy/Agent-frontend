import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useJobs } from '../hooks/useJobs'
import { RFQ_WORKFLOW_ID } from '../constants'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { RefreshButton } from '../components/ui/RefreshButton'
import { getCustomerName } from '../utils/status'
import { formatRelativeTime } from '../utils/time'
import { getJobById } from '../api/jobs'
import { getEmailThread, getEmailMessage } from '../api/thread'
import { detectHitlType } from '../utils/hitl'
import type { Job, JobDetail, Task } from '../types/job'
import type { ThreadMessage } from '../api/thread'

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  success: '#16a34a',
  failed: '#dc2626',
  running: '#2563eb',
  queued: '#737373',
  interrupted: '#d97706',
}

function safeRegex(q: string): RegExp | null {
  try { return new RegExp(q, 'i') } catch { return null }
}

function jobMatchesQuery(job: Job, q: string): boolean {
  const rx = safeRegex(q)
  const haystack = [String(job.id), job.status, getCustomerName(job)].join(' ')
  return rx ? rx.test(haystack) : haystack.toLowerCase().includes(q.toLowerCase())
}

// ─── Pipeline stages stepper ─────────────────────────────────────────────────

interface Stage {
  key: string
  label: string
  icon: string
}

const PIPELINE_STAGES: Stage[] = [
  { key: 'received',    label: 'Received',    icon: '✉' },
  { key: 'extraction',  label: 'Extraction',  icon: '🔍' },
  { key: 'rate',        label: 'Rate Fetch',  icon: '📡' },
  { key: 'calculation', label: 'Calculation', icon: '🧮' },
  { key: 'draft',       label: 'Email Draft', icon: '✏️' },
  { key: 'review',      label: 'Review',      icon: '👤' },
  { key: 'sent',        label: 'Sent',        icon: '✅' },
]

function taskDone(tasks: Task[], ...keywords: string[]): boolean {
  return tasks.some(
    (t) => keywords.some((k) => (t.title ?? '').toLowerCase().includes(k) || (t.node_key ?? '').toLowerCase().includes(k))
      && (t.status === 'success' || t.status === 'completed')
  )
}

function deriveCompletedStages(job: JobDetail): Set<string> {
  const tasks = job.tasks ?? []
  const done = new Set<string>(['received'])
  if (taskDone(tasks, 'get_tier', 'extract'))              done.add('extraction')
  if (taskDone(tasks, 'get_rate', 'rate'))                 done.add('rate')
  if (taskDone(tasks, 'calculate'))                        done.add('calculation')
  if (taskDone(tasks, 'generate', 'draft', 'email_draft')) done.add('draft')
  const reviewDone = (job.interventions ?? []).some((i) => i.action_taken)
  if (reviewDone) {
    // If review was completed, email draft must have happened before it
    done.add('draft')
    done.add('review')
  }
  if (job.status === 'success')                            done.add('sent')
  return done
}

function deriveActiveStage(job: JobDetail): string {
  const tasks = job.tasks ?? []
  if (job.status === 'success') return 'sent'
  if (job.status === 'failed')  return ''
  const running = tasks.find((t) => t.status === 'running')
  if (running) {
    const title = (running.title ?? '').toLowerCase()
    if (title.includes('get_tier') || title.includes('extract')) return 'extraction'
    if (title.includes('get_rate') || title.includes('rate'))    return 'rate'
    if (title.includes('calculate'))                             return 'calculation'
    if (title.includes('generate') || title.includes('draft'))   return 'draft'
  }
  const pending = (job.interventions ?? []).find((i) => !i.action_taken)
  if (pending) return 'review'
  return ''
}

function PipelineStepper({ job }: { job: JobDetail }) {
  const completed = deriveCompletedStages(job)
  const active    = deriveActiveStage(job)
  const failed    = job.status === 'failed'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 24px', background: 'white', borderRadius: 10,
      border: '1px solid var(--gray-100)', marginBottom: 20, flexWrap: 'wrap', gap: 8,
    }}>
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone   = completed.has(stage.key)
        const isActive = stage.key === active
        const isFailed = failed && !isDone && isActive

        let dotBg = 'var(--gray-100)'
        let dotColor = 'var(--gray-400)'
        let labelColor = 'var(--gray-400)'
        if (isDone)   { dotBg = '#dcfce7'; dotColor = '#16a34a'; labelColor = '#16a34a' }
        if (isActive) { dotBg = '#eff6ff'; dotColor = '#2563eb'; labelColor = '#2563eb' }
        if (isFailed) { dotBg = '#fee2e2'; dotColor = '#dc2626'; labelColor = '#dc2626' }

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: dotBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, border: isActive ? '2px solid #2563eb' : isDone ? '2px solid #16a34a' : '2px solid var(--gray-200)',
                transition: 'all 0.2s',
              }}>
                {isDone ? '✓' : stage.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: labelColor, whiteSpace: 'nowrap' }}>
                {stage.label}
              </span>
            </div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div style={{
                width: 32, height: 2, background: isDone ? '#86efac' : 'var(--gray-200)',
                margin: '-14px 4px 0', flexShrink: 0,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Message card ─────────────────────────────────────────────────────────────

function MessageCard({ msg, index }: {
  msg: ThreadMessage
  index: number
}) {
  const msgId  = msg.id ?? String(index)
  const isOut  = (msg.labels ?? []).some((l) => l.id === 'SENT')
  const [showFull, setShowFull] = useState(false)

  // Fetch complete message only when user asks for it
  const { data: fullMsgData, isLoading: fullMsgLoading } = useQuery({
    queryKey: ['message', msgId],
    queryFn: () => getEmailMessage(msgId),
    enabled: showFull && !!msg.id,
    staleTime: Infinity,
  })

  // Extract body from full message response — try common shapes
  const fullBody: string | null = (() => {
    if (!fullMsgData) return null
    const d = fullMsgData as Record<string, unknown>
    return (d.body ?? d.html ?? d.text ?? d.content ?? d.data ?? null) as string | null
  })()

  const from    = msg.From ?? ''
  const to      = msg.To ?? ''
  const subject = msg.Subject ?? ''
  const snippet = msg.snippet ?? ''

  let ts = ''
  if (msg.internalDate) {
    const d = new Date(parseInt(msg.internalDate))
    ts = d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div style={{
      border: '1px solid var(--gray-100)', borderRadius: 8, overflow: 'hidden',
      borderLeft: `3px solid ${isOut ? '#2563eb' : '#d97706'}`,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '10px 14px', background: 'var(--gray-50)', flexWrap: 'wrap', gap: 6,
      }}>
        <div>
          {subject && <div style={{ fontWeight: 600, fontSize: 13 }}>{subject}</div>}
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
            {from && <span><b>From:</b> {from}</span>}
            {to   && <span style={{ marginLeft: 12 }}><b>To:</b> {to}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
            background: isOut ? '#eff6ff' : '#fffbeb',
            color: isOut ? '#2563eb' : '#d97706',
          }}>
            {isOut ? 'OUTBOUND' : 'INBOUND'}
          </span>
          {ts && <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{ts}</span>}
        </div>
      </div>

      {/* Snippet preview */}
      {snippet && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--gray-100)' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-600)', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
            {snippet}
          </p>
        </div>
      )}

      {/* Action bar */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--gray-100)',
        background: 'var(--gray-50)', display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        {/* View Full Message — available on all messages with an id */}
        {msg.id && (
          <button
            onClick={() => setShowFull((v) => !v)}
            disabled={fullMsgLoading}
            style={{
              background: 'none', border: '1px solid var(--gray-300)', borderRadius: 5,
              color: 'var(--gray-600)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {fullMsgLoading
              ? <><Spinner size="sm" /> Fetching…</>
              : showFull ? 'Hide Full Message ↑' : 'View Full Message ↓'}
          </button>
        )}

      </div>

      {/* Full message body from webhook */}
      {showFull && !fullMsgLoading && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--gray-100)' }}>
          {fullBody ? (
            fullBody.trim().startsWith('<')
              ? <iframe
                  srcDoc={fullBody}
                  sandbox="allow-same-origin"
                  title={`full-msg-${index}`}
                  style={{ width: '100%', border: 'none', minHeight: 200, maxHeight: 600 }}
                />
              : <pre style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--gray-700)' }}>
                  {fullBody}
                </pre>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', textAlign: 'center', padding: '12px 0' }}>
              No message body in response.
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Trail view ───────────────────────────────────────────────────────────────

function TrailView({ job: listJob, onBack }: { job: Job; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['job', listJob.id] })
    queryClient.invalidateQueries({ queryKey: ['thread'] })
    queryClient.invalidateQueries({ queryKey: ['message'] })
    setLastRefreshed(new Date())
  }

  // Fetch full job detail — used only for the pipeline stepper
  const { data: jobDetail } = useQuery({
    queryKey: ['job', listJob.id],
    queryFn: () => getJobById(listJob.id),
    staleTime: 30_000,
  })

  // Debug: log raw detail so we can see all fields returned by the API
  if (jobDetail && !jobDetail.ticket_id) {
    console.warn(`[EmailAuditTrail] job ${listJob.id} has no ticket_id. Raw keys:`, Object.keys(jobDetail))
  }

  // Prefer ticket_id from detail (normalised), then list job, then null
  const threadId = jobDetail?.ticket_id ?? listJob.ticket_id ?? null

  // Primary request: email thread from webhook
  const { data: threadData, isLoading: threadLoading, isError: threadError } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => getEmailThread(threadId!),
    enabled: !!threadId,
    staleTime: 0,   // always refetch — thread updates after send_email action
    retry: 1,
  })
  const threadMessages: ThreadMessage[] = threadData?.messages ?? []

  // Extract the HTML from the Type 3 HITL intervention (the quote email body)
  const quoteEmailHtml = useMemo(() => {
    if (!jobDetail) return null
    const type3 = (jobDetail.interventions ?? []).find((inv) => detectHitlType(inv) === 3)
    if (!type3) return null
    const ar = type3.interrupt.details.ai_response
    return typeof ar === 'string' ? ar : null
  }, [jobDetail])

  const customer = getCustomerName(listJob)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none',
            border: '1px solid var(--gray-200)', borderRadius: 6, padding: '6px 12px',
            cursor: 'pointer', fontSize: 13, color: 'var(--gray-700)', fontWeight: 500,
          }}
        >
          ← Back
        </button>
        <RefreshButton onRefresh={handleRefresh} lastRefreshed={lastRefreshed} />
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>#RFQ-{listJob.id}</span>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: STATUS_COLOR[listJob.status] ?? 'var(--gray-500)',
          background: (STATUS_COLOR[listJob.status] ?? 'var(--gray-500)') + '18',
          borderRadius: 4, padding: '2px 7px',
        }}>
          {listJob.status}
        </span>
        {customer !== '—' && (
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{customer}</span>
        )}
        {threadId && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>
            thread: {threadId}
          </span>
        )}
      </div>

      {/* Pipeline stepper — shown once job detail is ready */}
      {jobDetail && <PipelineStepper job={jobDetail} />}

      {/* Email thread */}
      <div className="card card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, color: '#2563eb' }}>
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
          <span className="section-title" style={{ margin: 0 }}>Email Audit Trail</span>
          {threadLoading && <Spinner size="sm" />}
          {!threadLoading && threadMessages.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 4 }}>
              {threadMessages.length} message{threadMessages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!threadId && (
          <div style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            No email thread linked to this job.
          </div>
        )}

        {threadId && threadError && (
          <div style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Failed to load email thread. The thread may not be available yet.
          </div>
        )}

        {threadId && !threadLoading && !threadError && threadMessages.length === 0 && (
          <div style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            No messages found in this thread.
          </div>
        )}

        {threadLoading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}><Spinner size="lg" /></div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {threadMessages.map((msg, i) => (
            <MessageCard
              key={msg.id ?? String(i)}
              msg={msg}
              index={i}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Job card (list view) ────────────────────────────────────────────────────

function JobAuditCard({ job, onGetTrail }: { job: Job; onGetTrail: (job: Job) => void }) {
  const customer = getCustomerName(job)
  const color = STATUS_COLOR[job.status] ?? 'var(--gray-500)'

  return (
    <div className="card card-body" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 12, padding: '14px 18px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          #RFQ-{job.id}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, color,
          background: color + '18', borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
        }}>
          {job.status}
        </span>
        {customer !== '—' && (
          <span style={{ fontSize: 13, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {customer}
          </span>
        )}
        {job.ticket_id && (
          <span style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>
            {job.ticket_id}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
          {formatRelativeTime(job.created_at)}
        </span>
        <Button variant="primary" onClick={() => onGetTrail(job)}>
          Get Trail →
        </Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function EmailAuditTrail() {
  const { jobId: paramJobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  const [searchQuery, setSearchQuery]     = useState('')
  const [trailJob,    setTrailJob]        = useState<Job | null>(null)
  const [lookupError, setLookupError]     = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    setLastRefreshed(new Date())
  }

  const { data: jobsData, isLoading: jobsLoading } = useJobs({
    workflow_ids: [RFQ_WORKFLOW_ID],
    result_per_page: 50,
    order_by: 'desc',
    sort_by: 'created_at',
  })
  const jobs = jobsData?.jobs ?? []

  const paramId = paramJobId ? parseInt(paramJobId) : null

  // Auto-open trail from URL param — triggers when param changes or list loads.
  // If the job isn't in the loaded 50, fall back to a direct backend fetch.
  useEffect(() => {
    if (!paramId || jobsLoading) return
    const found = jobs.find((j) => j.id === paramId)
    if (found) {
      setTrailJob(found)
      return
    }
    // Not in list — fetch directly
    setLookupLoading(true)
    setLookupError('')
    getJobById(paramId)
      .then((detail) => {
        setTrailJob(detail as unknown as Job)
      })
      .catch(() => {
        setLookupError(`Job #${paramId} not found.`)
      })
      .finally(() => setLookupLoading(false))
  }, [paramId, jobsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = searchQuery.trim()
  const filteredJobs = trimmed ? jobs.filter((j) => jobMatchesQuery(j, trimmed)) : jobs

  const numericQuery = /^\d+$/.test(trimmed) ? parseInt(trimmed) : null
  const inLoadedList = numericQuery ? jobs.some((j) => j.id === numericQuery) : false
  const showLookupOption = numericQuery && !inLoadedList && filteredJobs.length === 0

  const handleLookup = useCallback(async () => {
    if (!numericQuery) return
    setLookupLoading(true)
    setLookupError('')
    try {
      const detail = await getJobById(numericQuery)
      if (detail.workflow_id && detail.workflow_id !== RFQ_WORKFLOW_ID) {
        setLookupError(`Job #${numericQuery} exists but is not an RFQ job.`)
      } else {
        setTrailJob(detail as unknown as Job)
        setSearchQuery('')
      }
    } catch {
      setLookupError(`Job #${numericQuery} not found.`)
    } finally {
      setLookupLoading(false)
    }
  }, [numericQuery])

  // ── Trail view ──
  if (trailJob) {
    return (
      <TrailView
        job={trailJob}
        onBack={() => {
          setTrailJob(null)
          setLookupError('')
          navigate('/audit')
        }}
      />
    )
  }

  // ── List view ──
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <RefreshButton onRefresh={handleRefresh} lastRefreshed={lastRefreshed} />
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 420 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--gray-400)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by job ID, status or customer… (supports regex)"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setLookupError('') }}
            style={{
              width: '100%', padding: '8px 12px 8px 32px', fontSize: 13,
              border: '1px solid var(--gray-200)', borderRadius: 6,
              outline: 'none', background: 'white', boxSizing: 'border-box',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
          {jobsLoading ? 'Loading…' : `${filteredJobs.length} job${filteredJobs.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {jobsLoading && <div style={{ textAlign: 'center', padding: 60 }}><Spinner size="lg" /></div>}

      {!jobsLoading && filteredJobs.map((job) => (
        <JobAuditCard key={job.id} job={job} onGetTrail={(j) => { setLookupError(''); setTrailJob(j) }} />
      ))}

      {!jobsLoading && showLookupOption && (
        <div style={{ textAlign: 'center', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>
            No loaded jobs match <b>#{numericQuery}</b>. Try fetching directly?
          </div>
          <Button variant="primary" loading={lookupLoading} onClick={handleLookup}>
            Fetch job #{numericQuery} from backend
          </Button>
          {lookupError && <div style={{ fontSize: 13, color: '#dc2626' }}>{lookupError}</div>}
        </div>
      )}

      {!jobsLoading && !showLookupOption && filteredJobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)', fontSize: 14 }}>
          No jobs matched your search.
        </div>
      )}
    </div>
  )
}
