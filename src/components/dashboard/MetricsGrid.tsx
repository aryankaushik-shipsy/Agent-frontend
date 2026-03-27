import { MetricCard } from '../ui/MetricCard'

interface MetricsGridProps {
  activeRFQs: number | undefined
  quotesToday: number | undefined
  pendingApprovals: number | undefined
  loadingActive: boolean
  loadingToday: boolean
  loadingInsights: boolean
}

export function MetricsGrid({
  activeRFQs,
  quotesToday,
  pendingApprovals,
  loadingActive,
  loadingToday,
  loadingInsights,
}: MetricsGridProps) {
  return (
    <div className="metrics-grid">
      <MetricCard
        label="Active RFQs"
        value={activeRFQs ?? 0}
        loading={loadingActive}
        iconBg="var(--blue-light)"
        icon={
          <svg viewBox="0 0 24 24" fill="var(--blue)">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z" />
          </svg>
        }
      />
      <MetricCard
        label="Quotes Sent Today"
        value={quotesToday ?? 0}
        loading={loadingToday}
        iconBg="var(--green-light)"
        icon={
          <svg viewBox="0 0 24 24" fill="var(--green)">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        }
      />
      <MetricCard
        label="Pending Approvals"
        value={pendingApprovals ?? 0}
        loading={loadingInsights}
        iconBg="var(--yellow-light)"
        icon={
          <svg viewBox="0 0 24 24" fill="var(--yellow)">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        }
      />
    </div>
  )
}
