import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getInsights } from '../api/insights'
import { getJobs } from '../api/jobs'
import { RFQ_WORKFLOW_ID } from '../constants'
import { MetricsGrid } from '../components/dashboard/MetricsGrid'
import { RecentRFQsTable } from '../components/dashboard/RecentRFQsTable'
import { AIPerformancePanel } from '../components/dashboard/AIPerformancePanel'
import { DateRangeFilter, presetToRange, type DatePreset, type DateRange } from '../components/pipeline/DateRangeFilter'

const PRESET_LABELS: Record<DatePreset, string> = {
  today:     'Today',
  yesterday: 'Yesterday',
  last7:     'Last 7 days',
  last30:    'Last 30 days',
  custom:    'Custom range',
}

export function Dashboard() {
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [dateRange, setDateRange]   = useState<DateRange>(() => presetToRange('today'))

  const { from, to } = dateRange

  function handleDateChange(preset: DatePreset, range: DateRange) {
    setDatePreset(preset)
    setDateRange(range)
  }

  const results = useQueries({
    queries: [
      // 0 — insights (AI performance panel + pending approvals badge)
      {
        queryKey: ['insights', from, to],
        queryFn: () => getInsights(from, to),
        staleTime: 60_000,
      },
      // 1 — active RFQs count (not date-scoped — shows what's currently running)
      {
        queryKey: ['jobs', { statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }),
        staleTime: 30_000,
      },
      // 2 — quotes sent in selected date range
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }),
        staleTime: 30_000,
      },
      // 3 — recent non-intervention jobs (API excludes active_interventions when filter absent)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 30_000,
      },
      // 5 — recent pending-intervention jobs (separate call needed — API can't return both in one)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 30_000,
      },
      // 4 — completed jobs for avg runtime (scoped to selected date range)
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }),
        staleTime: 60_000,
      },
    ],
  })

  const [insightsRes, activeRes, todayRes, recentRes, completedRes, pendingRes] = results

  // Merge regular + pending-intervention jobs, deduplicate, sort newest first, cap at 10
  const recentJobs = (() => {
    const all = [...(recentRes.data?.jobs ?? []), ...(pendingRes.data?.jobs ?? [])]
    const seen = new Set<number>()
    return all
      .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
  })()

  return (
    <div>
      {/* Date range selector — controls all metrics + recent RFQs table */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <DateRangeFilter value={datePreset} onChange={handleDateChange} />
      </div>

      <MetricsGrid
        activeRFQs={activeRes.data?.total}
        quotesToday={todayRes.data?.total}
        pendingApprovals={insightsRes.data?.active_interventions}
        loadingActive={activeRes.isLoading}
        loadingToday={todayRes.isLoading}
        loadingInsights={insightsRes.isLoading}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Recent RFQs</div>
              <div className="section-sub">{PRESET_LABELS[datePreset]} — click to open</div>
            </div>
          </div>
          <RecentRFQsTable
            jobs={recentJobs}
            loading={recentRes.isLoading && pendingRes.isLoading}
          />
        </div>

        <AIPerformancePanel
          insights={insightsRes.data}
          completedJobs={completedRes.data?.jobs ?? []}
          loadingInsights={insightsRes.isLoading}
          loadingJobs={completedRes.isLoading}
        />
      </div>
    </div>
  )
}
