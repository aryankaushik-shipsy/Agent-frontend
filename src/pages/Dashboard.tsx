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
import { detectHitlType, getPendingIntervention } from '../utils/hitl'
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

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['job'] })
    setLastRefreshed(new Date())
  }

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
      // 3 — recent non-intervention jobs (API excludes active_interventions when filter absent)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 4 — recent pending-intervention jobs (separate call needed — API can't return both in one)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, active_interventions: true, result_per_page: 10, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 5 — completed jobs for avg runtime (scoped to selected date range)
      {
        queryKey: ['jobs', { statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }],
        queryFn: () => getJobs({ statuses: ['success'], workflow_ids: [RFQ_WORKFLOW_ID], created_at_from: from, created_at_to: to, result_per_page: 100 }),
        staleTime: 60_000,
      },
      // 6 — ALL active-intervention jobs (wider page) — used to split Get Quote vs Send Quote counts
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], active_interventions: true, result_per_page: 50, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], active_interventions: true, result_per_page: 50, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
      // 7 — interrupted non-active-intervention jobs — used for Awaiting Ack count
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], statuses: ['interrupted'], active_interventions: false, result_per_page: 50, sort_by: 'created_at', order_by: 'desc' }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], statuses: ['interrupted'], active_interventions: false, result_per_page: 50, sort_by: 'created_at', order_by: 'desc' }),
        staleTime: 15_000,
        refetchInterval: 15_000,
      },
    ],
  })

  const [insightsRes, activeRes, todayRes, recentRes, pendingRes, completedRes, allPendingRes, interruptedRes] = results

  // IDs of jobs with active interventions (fetched separately — API excludes them otherwise)
  const pendingIds = new Set((pendingRes.data?.jobs ?? []).map(j => j.id))

  // Merge regular + pending-intervention jobs, deduplicate, sort newest first, cap at 10
  const recentJobs = (() => {
    const all = [...(recentRes.data?.jobs ?? []), ...(pendingRes.data?.jobs ?? [])]
    const seen = new Set<number>()
    return all
      .filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
  })()

  // Fetch full details for visible recent jobs (needed for input_json → route/mode/weight)
  // Safe now that we're date-scoped — only today's jobs (~10 max)
  const { data: recentDetails, isLoading: detailsLoading } = useJobDetails(recentJobs.map(j => j.id))
  const detailMap = new Map(recentDetails.map(d => [d.id, d]))
  // Merge detail onto list job — detail has input_json/tasks/interventions,
  // list job has created_at which the detail endpoint may omit.
  const recentJobsWithDetails = recentJobs.map(j => {
    const detail = detailMap.get(j.id)
    if (!detail) return j
    return { ...j, ...detail, created_at: detail.created_at ?? j.created_at }
  })

  // Fetch details for all pending intervention jobs to split by HITL type
  const allPendingJobs = allPendingRes.data?.jobs ?? []
  const { data: allPendingDetails } = useJobDetails(allPendingJobs.map(j => j.id))

  // Fetch details for interrupted non-active-intervention jobs to count awaiting-ack
  const interruptedJobs = interruptedRes.data?.jobs ?? []
  const { data: interruptedDetails } = useJobDetails(interruptedJobs.map(j => j.id))

  // Metric counts
  const getQuoteApprovalPending = allPendingDetails.filter(d => {
    const type = detectHitlType(getPendingIntervention(d.interventions)!)
    return type === 1 || type === 2
  }).length

  const sendQuoteApprovalPending = allPendingDetails.filter(d => {
    const type = detectHitlType(getPendingIntervention(d.interventions)!)
    return type === 3
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
