import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { detectHitlSubtype, getPendingIntervention } from '../../utils/hitl'
import { derivePipelineStage, getCustomerName, getShipmentFromHitl, getShipmentRow, getTraceReference } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import type { Job } from '../../types/job'
import type { JobDetail } from '../../types/job'
import type { HitlSubtype } from '../../types/hitl'
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
    const subtype = pending ? detectHitlSubtype(pending) : null
    const stage = detail ? derivePipelineStage(detail, subtype) : { label: 'Loading…', variant: 'gray' as BadgeVariant }

    let customer = '—', route = '—', mode = '—', weight = '—'
    let commodity: string | undefined, incoterms: string | undefined
    customer = getCustomerName(detail ?? job)

    // Primary source: Type 1 HITL form current_values (authoritative per v2 spec)
    const hitlShipment = detail ? getShipmentFromHitl(detail) : null
    if (hitlShipment?.origin && hitlShipment?.destination) {
      route = `${hitlShipment.origin} → ${hitlShipment.destination}`
      mode = hitlShipment.mode ?? '—'
      weight = hitlShipment.weight_kg != null ? `${hitlShipment.weight_kg} kg` : '—'
      commodity = hitlShipment.commodity
      incoterms = hitlShipment.incoterms
    } else {
      // Fallback: input_json.data[0] (pre-policy-upgrade jobs or no Type 1 yet)
      const shipment = getShipmentRow(job)
      if (shipment?.origin && shipment?.destination) {
        route = `${shipment.origin} → ${shipment.destination}`
        mode = shipment.mode ?? '—'
        weight = shipment.weight_kg != null ? `${shipment.weight_kg} kg` : '—'
        commodity = shipment.commodity
        incoterms = shipment.incoterms
      }
    }

    // Latest task = last in array (tasks are ordered by execution)
    const tasks = detail?.tasks ?? []
    const latestTask = tasks.length > 0 ? tasks[tasks.length - 1] : null
    const latestTaskKey = latestTask?.node_key ?? latestTask?.title ?? '—'

    const traceRef = getTraceReference(detail ?? job)
    return { job, detail, subtype, stage, customer, route, mode, weight, commodity, incoterms, latestTaskKey, traceRef }
  }).filter((row) => {
    if (!searchQuery) return true
    const q = searchQuery.trim()
    // Exact match on reference number (case-insensitive)
    if (row.traceRef && row.traceRef.toLowerCase() === q.toLowerCase()) return true
    // Fuzzy match on ID, route, customer
    const ql = q.toLowerCase()
    return (
      String(row.job.id).includes(ql) ||
      row.route.toLowerCase().includes(ql) ||
      row.customer.toLowerCase().includes(ql)
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
            <th>Latest Task</th>
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
          {rows.map(({ job, subtype, stage, customer, route, mode, weight, commodity, incoterms, latestTaskKey }) => (
            <tr key={job.id}>
              <td className="td-bold td-mono">#RFQ-{job.id}</td>
              <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detailsLoading && customer === '—' ? <Spinner size="sm" /> : customer}
              </td>
              <td>
                <div>{route}</div>
                {(commodity || incoterms) && (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                    {[commodity, incoterms].filter(Boolean).join(' · ')}
                  </div>
                )}
              </td>
              <td>{mode}</td>
              <td>{weight}</td>
              <td>
                <Badge variant={stage.variant as BadgeVariant}>{stage.label}</Badge>
              </td>
              <td style={{ fontSize: 12, color: 'var(--gray-600)', fontFamily: 'monospace' }}>
                {latestTaskKey !== '—' ? latestTaskKey : (
                  job.status === 'running' ? <Spinner size="sm" /> : '—'
                )}
              </td>
              <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                {formatRelativeTime(job.created_at)}
              </td>
              <td>
                {(() => {
                  // HITL action buttons are only valid while the job is actively
                  // waiting for human input. Failed / succeeded / running jobs
                  // may still carry a stale pending intervention in their list,
                  // so we gate explicitly on status === 'interrupted'.
                  const isAwaitingAction = job.status === 'interrupted' && !!subtype

                  if (isAwaitingAction && subtype === 'type1') {
                    return (
                      <Button variant="ghost" onClick={() => navigate(`/approvals/${job.id}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        Review
                      </Button>
                    )
                  }
                  if (isAwaitingAction && subtype === 'type2_step0') {
                    return (
                      <Button variant="primary" onClick={() => navigate(`/pipeline/${job.id}/quote`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        View Quote
                      </Button>
                    )
                  }
                  if (isAwaitingAction && subtype === 'type2_step1') {
                    return (
                      <Button variant="primary" onClick={() => navigate(`/pipeline/${job.id}/quote/edit`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        Review Pricing
                      </Button>
                    )
                  }
                  if (isAwaitingAction && subtype === 'type2_step2') {
                    return (
                      <Button variant="primary" onClick={() => navigate(`/pipeline/${job.id}/quote/confirm`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        Approve
                      </Button>
                    )
                  }
                  if (isAwaitingAction && subtype === 'type3') {
                    return (
                      <Button variant="ghost" onClick={() => navigate(`/approvals`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        Review Email
                      </Button>
                    )
                  }
                  if (isAwaitingAction && subtype === 'vendor_rfq') {
                    return (
                      <Button variant="ghost" onClick={() => navigate(`/approvals/${job.id}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        View Status
                      </Button>
                    )
                  }
                  if (job.status === 'running' || job.status === 'queued') {
                    return <Spinner size="sm" />
                  }
                  // Everything else (success / failed / interrupted-without-subtype)
                  // gets View Trail so the user can inspect what happened.
                  return (
                    <Button variant="ghost" onClick={() => navigate(`/audit/${job.id}`)} style={{ fontSize: 12, padding: '4px 10px' }}>
                      View Trail
                    </Button>
                  )
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
