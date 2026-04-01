import { MetricCard } from '../ui/MetricCard'

interface MetricsGridProps {
  awaitingAck: number
  getQuoteApprovalPending: number
  sendQuoteApprovalPending: number
  quotesToday: number | undefined
  loadingPending: boolean
  loadingInterrupted: boolean
  loadingToday: boolean
}

export function MetricsGrid({
  awaitingAck,
  getQuoteApprovalPending,
  sendQuoteApprovalPending,
  quotesToday,
  loadingPending,
  loadingInterrupted,
  loadingToday,
}: MetricsGridProps) {
  return (
    <div className="metrics-grid">
      <MetricCard
        label="Awaiting Customer Ack"
        value={awaitingAck}
        loading={loadingInterrupted}
        iconBg="#eff6ff"
        icon={
          <svg viewBox="0 0 24 24" fill="#2563eb">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        }
      />
      <MetricCard
        label="Get Quote Approval Pending"
        value={getQuoteApprovalPending}
        loading={loadingPending}
        iconBg="#faf5ff"
        icon={
          <svg viewBox="0 0 24 24" fill="#7c3aed">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z" />
          </svg>
        }
      />
      <MetricCard
        label="Send Quote Approval Pending"
        value={sendQuoteApprovalPending}
        loading={loadingPending}
        iconBg="#fff7ed"
        icon={
          <svg viewBox="0 0 24 24" fill="#ea580c">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
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
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        }
      />
    </div>
  )
}
