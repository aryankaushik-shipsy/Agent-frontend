import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { deriveJobStatus, getShipmentRow, getShipmentFromHitl, getTraceReference } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import type { Job, JobDetail } from '../../types/job'
import type { BadgeVariant } from '../../utils/status'

interface Props {
  jobs: Array<Job | JobDetail>
  loading: boolean
  pendingIds?: Set<number>   // jobs known to have an active intervention
  searchQuery?: string
}

export function RecentRFQsTable({ jobs, loading, pendingIds, searchQuery = '' }: Props) {
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

  const filteredJobs = searchQuery.trim()
    ? jobs.filter((job) => {
        const q = searchQuery.trim()
        const ql = q.toLowerCase()
        const traceRef = getTraceReference(job)
        // Exact match on reference number
        if (traceRef && traceRef.toLowerCase() === ql) return true
        // Fuzzy match on ID or route info
        const shipment = getShipmentRow(job)
        const route = shipment?.origin && shipment?.destination
          ? `${shipment.origin} ${shipment.destination}`.toLowerCase() : ''
        return String(job.id).includes(ql) || route.includes(ql)
      })
    : jobs

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
          {filteredJobs.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '32px' }}>
                No recent RFQs
              </td>
            </tr>
          )}
          {filteredJobs.map((job) => {
            const isPending = pendingIds?.has(job.id) ?? false
            // Status badge — mark pending-intervention jobs clearly
            // Pass tasks so deriveJobStatus can detect "Quote Sent · Awaiting Ack"
            const tasks = 'tasks' in job ? job.tasks : undefined
            const interventions = 'interventions' in job ? job.interventions : undefined
            const status = isPending
              ? { label: 'Pending Approval', variant: 'yellow' as BadgeVariant }
              : deriveJobStatus(job.status, null, tasks, interventions)

            // Route / mode / weight — try input_json first, then HITL Type1 payload
            let route = '—', mode = '—', weight = '—'
            const shipment = getShipmentRow(job)
            if (shipment?.origin && shipment?.destination) {
              route  = `${shipment.origin} → ${shipment.destination}`
              mode   = shipment.mode ?? '—'
              weight = shipment.weight_kg != null ? `${shipment.weight_kg} kg` : '—'
            } else if ('interventions' in job) {
              // Fallback: extract from Type 1 HITL form current_values
              const hitlShipment = getShipmentFromHitl(job as JobDetail)
              if (hitlShipment?.origin && hitlShipment?.destination) {
                route  = `${hitlShipment.origin} → ${hitlShipment.destination}`
                mode   = hitlShipment.mode ?? '—'
                weight = hitlShipment.weight_kg != null ? `${hitlShipment.weight_kg} kg` : '—'
              }
            }

            const handleClick = () => {
              if (isPending)                     navigate(`/approvals/${job.id}`)
              else if (job.status === 'success') navigate(`/audit/${job.id}`)
              else                               navigate('/pipeline')
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
