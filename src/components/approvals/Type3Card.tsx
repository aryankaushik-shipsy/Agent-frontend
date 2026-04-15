import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import { getToolArgsData } from '../../utils/hitl'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  onAction: (body: HITLActionRequest) => void
  loading: boolean
}

export function Type3Card({ job, intervention, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const toolArgs = getToolArgsData(intervention)
  const summary = intervention.interrupt_message?.context?.summary

  const [editMode, setEditMode] = useState(false)
  const [subject, setSubject] = useState(toolArgs?.args.subject ?? '')
  const [message, setMessage] = useState(toolArgs?.args.message ?? '')
  const [confirmSkip, setConfirmSkip] = useState(false)

  if (!toolArgs) return null

  function handleApprove() {
    onAction({ action: 'approved' })
  }

  function handleSkipRequest() {
    setConfirmSkip(true)
  }

  function handleSkipConfirm() {
    onAction({ action: 'skip' })
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

      {/* Subject */}
      <div className="hitl-form-row" style={{ marginBottom: 12 }}>
        <label className="hitl-form-label">Subject</label>
        {editMode ? (
          <input
            className="hitl-form-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        ) : (
          <span className="hitl-form-static">{subject || '—'}</span>
        )}
      </div>

      {/* Email body */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span className="hitl-form-label">Email Body</span>
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
        {editMode ? (
          <textarea
            className="hitl-form-input"
            style={{ width: '100%', minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        ) : (
          <iframe
            sandbox="allow-same-origin"
            srcDoc={message}
            style={{
              width: '100%', height: 240, border: '1px solid var(--gray-200)',
              borderRadius: 6, background: '#fff',
            }}
            title="Email preview"
          />
        )}
      </div>

      {confirmSkip && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
          padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991b1b',
        }}>
          Are you sure you want to skip sending this email? This action cannot be undone.
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button variant="red-outline" loading={loading} onClick={handleSkipConfirm}>
              Yes, Don&apos;t Send
            </Button>
            <Button variant="ghost" disabled={loading} onClick={() => setConfirmSkip(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!confirmSkip && (
        <div className="approval-actions">
          <Button variant="green" loading={loading} onClick={handleApprove}>
            Send Email
          </Button>
          <Button variant="red-outline" disabled={loading} onClick={handleSkipRequest}>
            Don&apos;t Send
          </Button>
        </div>
      )}
    </div>
  )
}
