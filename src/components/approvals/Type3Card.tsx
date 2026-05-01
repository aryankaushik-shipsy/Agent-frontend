import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime } from '../../utils/time'
import { stripHtml, getEmailHtmlFromIntervention } from '../../utils/hitl'
import { getCustomerName } from '../../utils/status'
import type { JobDetail, Intervention } from '../../types/job'

interface Props {
  job: JobDetail
  intervention: Intervention
  onAction: (action: string) => void
  loading: boolean
}

export function Type3Card({ job, intervention, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const rawHtml = getEmailHtmlFromIntervention(intervention)
  const excerpt = stripHtml(rawHtml).slice(0, 200)

  return (
    <div className="approval-card type-email">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="purple" dot={false}>Email Preview</Badge>
            </span>
          </div>
          <div className="approval-sub">{customer}</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          {formatRelativeTime(intervention.created_at ?? job.created_at)}
        </div>
      </div>

      {intervention.interrupt.details.summary && (
        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10, lineHeight: 1.5 }}>
          {intervention.interrupt.details.summary}
        </div>
      )}

      <div className="approval-excerpt">
        {excerpt}{excerpt.length === 200 ? '…' : ''}
      </div>

      <div className="approval-actions">
        <Button variant="ghost" disabled={loading} onClick={() => navigate(`/pipeline/${job.id}/email-preview`)}>
          Preview &amp; Send
        </Button>
        <Button variant="green" loading={loading} onClick={() => onAction('send_email')}>
          Send Email
        </Button>
        <Button variant="red-outline" disabled={loading} onClick={() => onAction('end')}>
          Manual Resolution
        </Button>
      </div>
    </div>
  )
}
