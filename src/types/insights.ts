export interface MetricItem {
  label: string
  value: number
}

export interface InsightsResponse {
  metrics: MetricItem[]
  active_interventions: number
}
