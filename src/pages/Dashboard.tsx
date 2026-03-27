import { useQueries } from '@tanstack/react-query'
import { getInsights } from '../api/insights'
import { getJobs } from '../api/jobs'
import { getTodayUTCRange } from '../utils/time'
import { RFQ_WORKFLOW_ID } from '../constants'
import { MetricsGrid } from '../components/dashboard/MetricsGrid'
import { RecentRFQsTable } from '../components/dashboard/RecentRFQsTable'
import { AIPerformancePanel } from '../components/dashboard/AIPerformancePanel'

export function Dashboard() {
  const { from, to } = getTodayUTCRange()

  const results = useQueries({
    queries: [
      // 0 — insights (card 3 + AI performance)
      {
        queryKey: ['insights', from, to],
        queryFn: () => getInsights(from, to),
        staleTime: 60_000,
      },
      // 1 — active RFQs count
      {
        queryKey: ['jobs', { statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }),
        staleTime: 30_000,
      },
      // 2 — quotes sent today
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }),
        staleTime: 30_000,
      },
      // 3 — recent 10 jobs for table
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 30_000,
      },
      // 4 — today's completed jobs for avg runtime
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }),
        staleTime: 60_000,
      },
    ],
  })

  const [insightsRes, activeRes, todayRes, recentRes, completedRes] = results

  return (
    <div>
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
              <div className="section-sub">Latest 10 jobs — click to open</div>
            </div>
          </div>
          <RecentRFQsTable
            jobs={recentRes.data?.jobs ?? []}
            loading={recentRes.isLoading}
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
