import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useJobs } from '../hooks/useJobs'
import { useJob } from '../hooks/useJob'
import { RFQ_WORKFLOW_ID } from '../constants'
import { JobSearchInput } from '../components/audit-trail/JobSearchInput'
import { StageFilter, type StageFilterValue } from '../components/audit-trail/StageFilter'
import { CompletionBar } from '../components/audit-trail/CompletionBar'
import { TaskEntry } from '../components/audit-trail/TaskEntry'
import { InterventionEntry } from '../components/audit-trail/InterventionEntry'
import { Spinner } from '../components/ui/Spinner'
import { detectHitlType, getPendingIntervention } from '../utils/hitl'
import { getEmailThread } from '../api/thread'
import type { Task, Intervention } from '../types/job'

type TimelineEntry =
  | { kind: 'task'; data: Task }
  | { kind: 'intervention'; data: Intervention }

function matchesStage(entry: TimelineEntry, filter: StageFilterValue): boolean {
  if (filter === 'all') return true
  if (entry.kind === 'intervention') return filter === 'hitl'
  const t = entry.data.title.toLowerCase()
  if (filter === 'extraction') return t.includes('get_tier')
  if (filter === 'rate') return t.includes('get_rate')
  if (filter === 'calculation') return t.includes('calculate')
  if (filter === 'email-gen') return t.includes('generate')
  if (filter === 'sent') return t.includes('send')
  return true
}

export function EmailAuditTrail() {
  const { jobId: paramJobId } = useParams<{ jobId: string }>()
  const [selectedJobId, setSelectedJobId] = useState<number | null>(
    paramJobId ? parseInt(paramJobId) : null
  )
  const [stageFilter, setStageFilter] = useState<StageFilterValue>('all')

  const { data: jobsData, isLoading: jobsLoading } = useJobs({
    workflow_ids: [RFQ_WORKFLOW_ID],
    result_per_page: 50,
    order_by: 'desc',
    sort_by: 'created_at',
  })
  const jobs = jobsData?.jobs ?? []

  // Auto-select first job if none selected
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id)
    }
  }, [jobs, selectedJobId])

  const { data: job, isLoading: jobLoading } = useJob(selectedJobId)

  // Fetch email thread from webhook when job has a ticket_id
  const threadId = job?.ticket_id ?? null
  const { data: threadData, isLoading: threadLoading } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => getEmailThread(threadId!),
    enabled: !!threadId,
    staleTime: 60_000,
    retry: 1,
  })
  const threadMessages = threadData
    ? (threadData.messages ?? threadData.thread ?? threadData.data ?? []) as Array<Record<string, unknown>>
    : []

  const timeline: TimelineEntry[] = []
  if (job) {
    for (const task of job.tasks ?? []) {
      timeline.push({ kind: 'task', data: task })
    }
    for (const intervention of job.interventions ?? []) {
      timeline.push({ kind: 'intervention', data: intervention })
    }
  }

  const filtered = timeline.filter((e) => matchesStage(e, stageFilter))

  const isLive = job?.status === 'running'
  const pending = getPendingIntervention(job?.interventions)
  const pendingType = pending ? detectHitlType(pending) : null

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {jobsLoading ? <Spinner size="sm" /> : (
          <JobSearchInput
            jobs={jobs}
            selectedId={selectedJobId}
            onChange={(id) => { setSelectedJobId(id); setStageFilter('all') }}
          />
        )}
        <StageFilter value={stageFilter} onChange={setStageFilter} />
      </div>

      {jobLoading && (
        <div style={{ textAlign: 'center', padding: 40 }}><Spinner size="lg" /></div>
      )}

      {!jobLoading && job && (
        <>
          <CompletionBar job={job} />

          {/* Live state indicators */}
          {isLive && pending && (
            <div className="banner banner-yellow" style={{ marginBottom: 16 }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <div className="banner-content">
                <div className="banner-title">
                  Waiting for human review
                  {pendingType === 1 && ' — Shipment Confirmation'}
                  {pendingType === 2 && ' — Carrier Selection'}
                  {pendingType === 3 && ' — Email Preview'}
                </div>
              </div>
            </div>
          )}
          {isLive && !pending && (
            <div className="banner banner-blue" style={{ marginBottom: 16 }}>
              <Spinner size="sm" />
              <div className="banner-content">Agent is processing…</div>
            </div>
          )}

          <div className="card card-body">
            <div className="section-title" style={{ marginBottom: 16 }}>Timeline</div>
            {filtered.length === 0 && (
              <div style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '24px 0' }}>
                No entries for this filter
              </div>
            )}
            <div className="timeline">
              {filtered.map((entry, i) => (
                entry.kind === 'task'
                  ? <TaskEntry key={`task-${entry.data.id}-${i}`} task={entry.data} />
                  : <InterventionEntry key={`int-${entry.data.id}-${i}`} intervention={entry.data} />
              ))}
            </div>
          </div>

          {/* Email thread from webhook */}
          {job.ticket_id && (
            <div className="card card-body" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className="section-title" style={{ margin: 0 }}>Email Thread</div>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                  {job.ticket_id}
                </span>
                {threadLoading && <Spinner size="sm" />}
              </div>

              {!threadLoading && threadMessages.length === 0 && (
                <div style={{ color: 'var(--gray-400)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  No email messages found for this thread.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {threadMessages.map((msg, i) => {
                  const from    = String(msg.from ?? msg.sender ?? '')
                  const to      = String(msg.to ?? msg.recipient ?? '')
                  const subject = String(msg.subject ?? '')
                  const body    = String(msg.body ?? msg.snippet ?? msg.text ?? '')
                  const html    = String(msg.html ?? '')
                  const ts      = String(msg.timestamp ?? msg.date ?? msg.created_at ?? '')
                  const isOutbound = from.toLowerCase().includes('shipsy') || from.toLowerCase().includes('freight')

                  return (
                    <div key={i} style={{
                      border: '1px solid var(--gray-100)', borderRadius: 8, overflow: 'hidden',
                      borderLeft: `3px solid ${isOutbound ? '#2563eb' : '#d97706'}`,
                    }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        padding: '10px 14px', background: 'var(--gray-50)', flexWrap: 'wrap', gap: 6,
                      }}>
                        <div>
                          {subject && <div style={{ fontWeight: 600, fontSize: 13 }}>{subject}</div>}
                          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                            {from && <span><b>From:</b> {from}</span>}
                            {to && <span style={{ marginLeft: 12 }}><b>To:</b> {to}</span>}
                          </div>
                        </div>
                        {ts && <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>{ts}</span>}
                      </div>
                      {(html || body) && (
                        <div style={{ padding: '12px 14px' }}>
                          {html
                            ? <iframe
                                srcDoc={html}
                                sandbox="allow-same-origin"
                                style={{ width: '100%', border: 'none', minHeight: 120, maxHeight: 400 }}
                                title={`email-${i}`}
                              />
                            : <p style={{ fontSize: 13, color: 'var(--gray-700)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {body}
                              </p>
                          }
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!jobLoading && !job && selectedJobId && (
        <div className="banner banner-yellow">
          <div className="banner-content">Could not load job details.</div>
        </div>
      )}
    </div>
  )
}
