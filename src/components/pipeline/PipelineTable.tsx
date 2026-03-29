import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { detectHitlType, getPendingIntervention, parseAiResponse } from '../../utils/hitl'
import { derivePipelineStage, getCustomerName, getShipmentRow } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import type { Job } from '../../types/job'
import type { JobDetail } from '../../types/job'
import type { Type1Payload } from '../../types/hitl'
import type { BadgeVariant } from '../../utils/status'

interface Props {
  jobs: Job[]
  details: JobDetail[]
  detailsLoading: boolean
  searchQuery: string
}

export function PipelineTable({ jobs, details, detailsLoading, searchQuery }: Props) {
  const navigate = useNavigate()

  const rows = jobs.map((job) => {
    const detail = details.find((d) => d.id === job.id)
    const pending = detail ? getPendingIntervention(detail.interventions) : undefined
    const hitlType = pending ? detectHitlType(pending) : null
    const stage = detail ? derivePipelineStage(detail, hitlType) : { label: 'Loading…', variant: 'gray' as BadgeVariant }

    let customer = '—', route = '—', mode = '—', weight = '—'
    customer = getCustomerName(detail ?? job)
    // Primary: input_json.data[0] (in list response, no detail fetch needed)
    const shipment = getShipmentRow(job)
    if (shipment?.origin && shipment?.destination) {
      route = `${shipment.origin} → ${shipment.destination}`
      mode = shipment.mode ?? '—'
      weight = shipment.weight_kg != null ? `${shipment.weight_kg} kg` : '—'
    } else if (detail) {
      // Fallback: HITL Type 1 payload
      const type1 = (detail.interventions ?? []).find((i) => {
        const p = parseAiResponse<Record<string, unknown>>(i)
        return p && 'items' in p
      })
      if (type1) {
        const payload = parseAiResponse<Type1Payload>(type1)
        if (payload?.items[0]) {
          const item = payload.items[0]
          route = `${item.origin} → ${item.destination}`
          mode = item.mode
          weight = `${item.weight_kg} kg`
        }
      }
    }

    const runningTask = detail?.tasks?.find((t) => t.status === 'running')
    const agentStep = runningTask?.title ?? '—'

    return { job, detail, hitlType, stage, customer, route, mode, weight, agentStep }
  }).filter((row) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      String(row.job.id).includes(q) ||
      row.route.toLowerCase().includes(q) ||
      row.customer.toLowerCase().includes(q)
    )
  })

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>RFQ ID</th>
            <th>Customer</th>
            <th>Route</th>
            <th>Mode</th>
            <th>Weight</th>
            <th>Pipeline Stage</th>
            <th>Agent Step</th>
            <th>Received</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="empty-state" style={{ border: 'none', padding: '32px', textAlign: 'center', color: 'var(--gray-400)' }}>
                No jobs found
              </td>
            </tr>
          )}
          {rows.map(({ job, hitlType, stage, customer, route, mode, weight, agentStep }) => (
            <tr key={job.id}>
              <td className="td-bold td-mono">#RFQ-{job.id}</td>
              <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detailsLoading && customer === '—' ? <Spinner size="sm" /> : customer}
              </td>
              <td>{route}</td>
              <td>{mode}</td>
              <td>{weight}</td>
              <td>
                <Badge variant={stage.variant as BadgeVariant}>{stage.label}</Badge>
              </td>
              <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                {agentStep !== '—' ? agentStep : (
                  job.status === 'running' ? <Spinner size="sm" /> : '—'
                )}
              </td>
              <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                {formatRelativeTime(job.created_at)}
              </td>
              <td>
                {hitlType === 1 && (
                  <Button variant="ghost" onClick={() => navigate('/approvals')} style={{ fontSize: 12, padding: '4px 10px' }}>
                    Review
                  </Button>
                )}
                {hitlType === 2 && (
                  <Button variant="primary" onClick={() => navigate(`/pipeline/${job.id}/quote`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                    View Quote
                  </Button>
                )}
                {hitlType === 3 && (
                  <Button variant="ghost" onClick={() => navigate(`/pipeline/${job.id}/email-preview`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                    Preview Email
                  </Button>
                )}
                {job.status === 'success' && (
                  <Button variant="ghost" onClick={() => navigate(`/audit/${job.id}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                    View
                  </Button>
                )}
                {(job.status === 'running' || job.status === 'queued') && !hitlType && (
                  <Spinner size="sm" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
