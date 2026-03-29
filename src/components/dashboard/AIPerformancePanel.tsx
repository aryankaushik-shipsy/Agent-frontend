import { Spinner } from '../ui/Spinner'
import { formatRuntime } from '../../utils/time'
import type { InsightsResponse } from '../../types/insights'
import type { Job } from '../../types/job'

interface Props {
  insights: InsightsResponse | undefined
  completedJobs: Job[]
  loadingInsights: boolean
  loadingJobs: boolean
}

export function AIPerformancePanel({ insights, completedJobs, loadingInsights, loadingJobs }: Props) {
  const getMetric = (label: string): number => {
    return insights?.metrics?.find((m) => m.label === label)?.value ?? 0
  }

  const avgRuntime = completedJobs.length
    ? completedJobs.reduce((sum, j) => sum + (j.runtime ?? 0), 0) / completedJobs.length
    : 0

  const rows: Array<{ label: string; value: string | number; loading: boolean }> = [
    { label: 'Completed today', value: getMetric('Success'), loading: loadingInsights },
    { label: 'Failed today', value: getMetric('Failed'), loading: loadingInsights },
    { label: 'Currently running', value: getMetric('Running'), loading: loadingInsights },
    { label: 'Pending approvals', value: insights?.active_interventions ?? 0, loading: loadingInsights },
    { label: 'Avg response time', value: formatRuntime(avgRuntime), loading: loadingJobs },
  ]

  return (
    <div className="card card-body">
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title">AI Performance Today</div>
          <div className="section-sub">Real-time agent metrics</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11.5, color: 'var(--gray-600)', fontWeight: 500 }}>{row.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--dark)' }}>
              {row.loading ? <Spinner size="sm" /> : row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
