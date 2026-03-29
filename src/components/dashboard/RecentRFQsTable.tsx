import { useNavigate } from 'react-router-dom'
import { useJobDetails } from '../../hooks/useJobDetails'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { detectHitlType, getPendingIntervention, parseAiResponse } from '../../utils/hitl'
import { deriveJobStatus, getShipmentRow } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import type { Job } from '../../types/job'
import type { Type1Payload } from '../../types/hitl'
import type { BadgeVariant } from '../../utils/status'

interface Props {
  jobs: Job[]
  loading: boolean
}

export function RecentRFQsTable({ jobs, loading }: Props) {
  const navigate = useNavigate()
  const { data: details, isLoading: detailsLoading } = useJobDetails(jobs.map((j) => j.id))

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
            const detail = details.find((d) => d.id === job.id)
            const pending = detail ? getPendingIntervention(detail.interventions) : undefined
            const hitlType = pending ? detectHitlType(pending) : null
            const status = deriveJobStatus(job.status, hitlType)

            let route = '—', mode = '—', weight = '—'
            // Primary: input_json.data[0] (in list response, no detail fetch needed)
            const shipment = getShipmentRow(job)
            if (shipment?.origin && shipment?.destination) {
              route = `${shipment.origin} → ${shipment.destination}`
              mode = shipment.mode ?? '—'
              weight = shipment.weight_kg != null ? `${shipment.weight_kg} kg` : '—'
            } else if (detail) {
              // Fallback: HITL Type 1 payload
              const type1 = (detail.interventions ?? []).find((i) => {
                const parsed = parseAiResponse<Record<string, unknown>>(i)
                return parsed && 'items' in parsed
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

            const handleClick = () => {
              if (hitlType === 2) navigate(`/pipeline/${job.id}/quote`)
              else if (hitlType === 3) navigate(`/pipeline/${job.id}/email-preview`)
              else if (job.status === 'success') navigate(`/audit/${job.id}`)
              else navigate('/pipeline')
            }

            return (
              <tr key={job.id} onClick={handleClick} style={{ cursor: 'pointer' }}>
                <td className="td-bold td-mono">#RFQ-{job.id}</td>
                <td>{detailsLoading && !detail ? <Spinner size="sm" /> : route}</td>
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
