import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { deriveJobStatus, getShipmentRow } from '../../utils/status'
import { parseAiResponse } from '../../utils/hitl'
import { formatRelativeTime } from '../../utils/time'
import type { Job, JobDetail } from '../../types/job'
import type { Type1Payload } from '../../types/hitl'
import type { BadgeVariant } from '../../utils/status'

interface Props {
  jobs: Array<Job | JobDetail>
  loading: boolean
  pendingIds?: Set<number>   // jobs known to have an active intervention
}

export function RecentRFQsTable({ jobs, loading, pendingIds }: Props) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="card">
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>RFQ ID</th>
            <th>Route</th>
            <th>Mode</th>
            <th>Weight</th>
            <th>Status</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px' }}>
                No recent RFQs
              </td>
            </tr>
          )}
          {jobs.map((job) => {
            const isPending = pendingIds?.has(job.id) ?? false
            // Status badge — mark pending-intervention jobs clearly
            // Pass tasks so deriveJobStatus can detect "Quote Sent · Awaiting Ack"
            const tasks = 'tasks' in job ? job.tasks : undefined
            const status = isPending
              ? { label: 'Pending Approval', variant: 'yellow' as BadgeVariant }
              : deriveJobStatus(job.status, null, tasks)

            // Route / mode / weight — try input_json first, then HITL Type1 payload
            let route = '—', mode = '—', weight = '—'
            const shipment = getShipmentRow(job)
            if (shipment?.origin && shipment?.destination) {
              route  = `${shipment.origin} → ${shipment.destination}`
              mode   = shipment.mode ?? '—'
              weight = shipment.weight_kg != null ? `${shipment.weight_kg} kg` : '—'
            } else if ('interventions' in job && job.interventions?.length) {
              // Fallback: extract from HITL Type 1 payload (ai_response.items[0])
              const type1 = job.interventions.find((i) => {
                const p = parseAiResponse<Record<string, unknown>>(i)
                return p && 'items' in p
              })
              if (type1) {
                const payload = parseAiResponse<Type1Payload>(type1)
                if (payload?.items?.[0]) {
                  const item = payload.items[0]
                  route  = `${item.origin} → ${item.destination}`
                  mode   = item.mode ?? '—'
                  weight = item.weight_kg != null ? `${item.weight_kg} kg` : '—'
                }
              }
            }

            const handleClick = () => {
              if (isPending)                  navigate('/approvals')
              else if (job.status === 'success') navigate(`/audit/${job.id}`)
              else                            navigate('/pipeline')
            }

            return (
              <tr key={job.id} onClick={handleClick} style={{ cursor: 'pointer' }}>
                <td className="td-bold td-mono">#RFQ-{job.id}</td>
                <td>{route}</td>
                <td>{mode}</td>
                <td>{weight}</td>
                <td>
                  <Badge variant={status.variant as BadgeVariant}>
                    {status.label}
                  </Badge>
                </td>
                <td style={{ color: 'var(--gray-600)', fontSize: '12px' }}>
                  {formatRelativeTime(job.created_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
