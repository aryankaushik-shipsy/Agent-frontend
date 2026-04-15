import { useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { getInsights } from '../api/insights'
import { getJobs } from '../api/jobs'
import { RFQ_WORKFLOW_ID } from '../constants'
import { useJobDetails } from '../hooks/useJobDetails'
import { MetricsGrid } from '../components/dashboard/MetricsGrid'
import { RecentRFQsTable } from '../components/dashboard/RecentRFQsTable'
import { AIPerformancePanel } from '../components/dashboard/AIPerformancePanel'
import { DateRangeFilter, presetToRange, type DatePreset, type DateRange } from '../components/pipeline/DateRangeFilter'
import { SearchBox } from '../components/pipeline/SearchBox'
import { RefreshButton } from '../components/ui/RefreshButton'
import { Button } from '../components/ui/Button'
import { detectHitlSubtype, getPendingIntervention } from '../utils/hitl'
import { isAwaitingAck } from '../utils/status'

const PRESET_LABELS: Record<DatePreset, string> = {
  today:     'Today',
  yesterday: 'Yesterday',
  last7:     'Last 7 days',
  last30:    'Last 30 days',
  custom:    'Custom range',
}

export function Dashboard() {
  const queryClient = useQueryClient()
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [dateRange, setDateRange]   = useState<DateRange>(() => presetToRange('today'))
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())
  const [search, setSearch]         = useState('')
  const [recentPage, setRecentPage] = useState(1)

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['job'] })
    setLastRefreshed(new Date())
  }

  const { from, to } = dateRange

  function handleDateChange(preset: DatePreset, range: DateRange) {
    setDatePreset(preset)
    setDateRange(range)
    setRecentPage(1)
  }

  const results = useQueries({
    queries: [
      // 0 — insights (AI performance panel + pending approvals badge)
      {
        queryKey: ['insights', from, to],
        queryFn: () => getInsights(from, to),
        staleTime: 60_000,
      },
      // 1 — active RFQs count — anything non-terminal (running, queued, interrupted)
      {
        queryKey: ['jobs', { statuses: ['running', 'queued', 'interrupted'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['running', 'queued', 'interrupted'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 2 — quotes sent in selected date range
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 1 }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 3 — all non-intervention jobs for selected period (client-side paginated)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 4 — all pending-intervention jobs for selected period (client-side paginated)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 5 — completed jobs for avg runtime (scoped to selected date range)
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }),
        staleTime: 60_000,
      },
      // 6 — active-intervention jobs for selected period — used to split Get Quote vs Send Quote counts
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 7 — interrupted non-active-intervention jobs for selected period — used for Awaiting Ack count
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, statuses: ['interrupted'], active_interventions: false, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, statuses: ['interrupted'], active_interventions: false, result_per_page: 100, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
    ],
  })

  const [insightsRes, activeRes, todayRes, recentRes, pendingRes, completedRes, allPendingRes, interruptedRes] = results

  // IDs of jobs with active interventions (fetched separately — API excludes them otherwise)
  const pendingIds = new Set((pendingRes.data?.jobs ?? []).map(j => j.id))

  // Merge regular + pending-intervention jobs, deduplicate, sort newest first
  const allRecentJobs = (() => {
    const all = [...(recentRes.data?.jobs ?? []), ...(pendingRes.data?.jobs ?? [])]
    const seen = new Set<number>()
    return all
      .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  })()

  const recentTotal      = allRecentJobs.length
  const recentTotalPages = Math.max(1, Math.ceil(recentTotal / 10))

  // Fetch details for all jobs in this period, then paginate client-side
  const { data: recentDetails, isLoading: detailsLoading } = useJobDetails(allRecentJobs.map(j => j.id))
  const detailMap = new Map(recentDetails.map(d => [d.id, d]))
  const allRecentWithDetails = allRecentJobs.map(j => {
    const detail = detailMap.get(j.id)
    if (!detail) return j
    return { ...j, ...detail, created_at: detail.created_at ?? j.created_at }
  })

  // Client-side pagination
  const recentJobsWithDetails = allRecentWithDetails.slice((recentPage - 1) * 10, recentPage * 10)

  // Fetch details for all pending intervention jobs to split by HITL type
  const allPendingJobs = allPendingRes.data?.jobs ?? []
  const { data: allPendingDetails } = useJobDetails(allPendingJobs.map(j => j.id))

  // Fetch details for interrupted non-active-intervention jobs to count awaiting-ack
  const interruptedJobs = interruptedRes.data?.jobs ?? []
  const { data: interruptedDetails } = useJobDetails(interruptedJobs.map(j => j.id))

  // Metric counts
  const getQuoteApprovalPending = allPendingDetails.filter(d => {
    const subtype = detectHitlSubtype(getPendingIntervention(d.interventions)!)
    return subtype === 'type1' || subtype === 'type2_step0' || subtype === 'type2_step1'
  }).length

  const sendQuoteApprovalPending = allPendingDetails.filter(d => {
    const subtype = detectHitlSubtype(getPendingIntervention(d.interventions)!)
    return subtype === 'type3'
  }).length

  const awaitingAckCount = interruptedDetails.filter(d => isAwaitingAck(d)).length

  return (
    <div>
      {/* Date range selector + manual refresh */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <RefreshButton onRefresh={handleRefresh} lastRefreshed={lastRefreshed} />
        <DateRangeFilter value={datePreset} onChange={handleDateChange} />
      </div>

      <MetricsGrid
        awaitingAck={awaitingAckCount}
        getQuoteApprovalPending={getQuoteApprovalPending}
        sendQuoteApprovalPending={sendQuoteApprovalPending}
        quotesToday={todayRes.data?.total}
        loadingPending={allPendingRes.isLoading}
        loadingInterrupted={interruptedRes.isLoading}
        loadingToday={todayRes.isLoading}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="section-header">
            <div>
              <div className="section-title">Recent RFQs</div>
              <div className="section-sub">{PRESET_LABELS[datePreset]} — click to open</div>
            </div>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder="Search by ID, route, or reference…"
            />
          </div>
          <RecentRFQsTable
            jobs={recentJobsWithDetails}
            loading={(recentRes.isLoading && pendingRes.isLoading) || detailsLoading}
            pendingIds={pendingIds}
            searchQuery={search}
          />
          <div className="pagination">
            <span className="pagination-info">
              {recentTotal > 0
                ? `Showing ${Math.min((recentPage - 1) * 10 + 1, recentTotal)}–${Math.min(recentPage * 10, recentTotal)} of ${recentTotal}`
                : 'No results'}
            </span>
            <Button variant="ghost" disabled={recentPage <= 1} onClick={() => setRecentPage(p => p - 1)} style={{ padding: '5px 12px', fontSize: 12 }}>
              ← Prev
            </Button>
            <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{recentPage} / {recentTotalPages}</span>
            <Button variant="ghost" disabled={recentPage >= recentTotalPages} onClick={() => setRecentPage(p => p + 1)} style={{ padding: '5px 12px', fontSize: 12 }}>
              Next →
            </Button>
          </div>
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
