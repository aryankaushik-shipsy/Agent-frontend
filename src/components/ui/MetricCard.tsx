import type { ReactNode } from 'react'
import { Spinner } from './Spinner'

interface MetricCardProps {
  label: string
  value: string | number
  iconBg: string
  icon: ReactNode
  delta?: string
  loading?: boolean
}

export function MetricCard({ label, value, iconBg, icon, delta, loading }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {loading ? <Spinner size="sm" /> : value}
      </div>
      {delta && <div className="metric-delta">{delta}</div>}
    </div>
  )
}
