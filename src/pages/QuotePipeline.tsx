import { useState, useEffect, useRef } from 'react'
import { useQueries, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { useJobDetails } from '../hooks/useJobDetails'
import { FilterTabs, type PipelineTab } from '../components/pipeline/FilterTabs'
import { SearchBox } from '../components/pipeline/SearchBox'
import { PipelineTable } from '../components/pipeline/PipelineTable'
import { DateRangeFilter, presetToRange, type DatePreset, type DateRange } from '../components/pipeline/DateRangeFilter'
import { Button } from '../components/ui/Button'
import { RFQ_WORKFLOW_ID } from '../constants'
import type { JobFilter } from '../types/api'

function getFilter(tab: PipelineTab, page: number, dateRange: DateRange): JobFilter {
  const base: JobFilter = {
    workflow_ids: [RFQ_WORKFLOW_ID],
    result_per_page: 10,
    page_number: page,
    order_by: 'desc',
    sort_by: 'created_at',
    created_at_from: dateRange.from,
    created_at_to: dateRange.to,
  }
  switch (tab) {
    case 'processing': return { ...base, statuses: ['queued', 'running'], active_interventions: false }
    case 'pending':    return { ...base, active_interventions: true }
    case 'sent':       return { ...base, statuses: ['success'] }
    case 'failed':     return { ...base, statuses: ['failed', 'interrupted'] }
    default:           return base
  }
}

function getCountFilter(tab: PipelineTab, dateRange: DateRange): JobFilter {
  const base: JobFilter = {
    workflow_ids: [RFQ_WORKFLOW_ID],
    result_per_page: 1,
    created_at_from: dateRange.from,
    created_at_to: dateRange.to,
  }
  switch (tab) {
    case 'processing': return { ...base, statuses: ['queued', 'running'], active_interventions: false }
    case 'pending':    return { ...base, active_interventions: true }
    case 'sent':       return { ...base, statuses: ['success'] }
    case 'failed':     return { ...base, statuses: ['failed', 'interrupted'] }
    default:           return base
  }
}

const TABS: PipelineTab[] = ['all', 'processing', 'pending', 'sent', 'failed']
// "All" count is derived — API excludes active_interventions jobs when filter is absent
const COUNT_TABS: PipelineTab[] = ['processing', 'pending', 'sent', 'failed']

export function QuotePipeline() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab]   = useState<PipelineTab>('all')
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [dateRange, setDateRange]   = useState<DateRange>(() => presetToRange('today'))
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  function handleDateChange(preset: DatePreset, range: DateRange) {
    setDatePreset(preset)
    setDateRange(range)
    setPage(1)
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    queryClient.invalidateQueries({ queryKey: ['job'] })
    setLastRefreshed(new Date())
  }

  // Fetch jobs for current tab + date range
  const { data: jobsData, isLoading: jobsLoading } = useQueries({
    queries: [{
      queryKey: ['jobs', getFilter(activeTab, page, dateRange)],
      queryFn: () => getJobs(getFilter(activeTab, page, dateRange)),
      staleTime: 15_000,
      refetchInterval: 15_000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }],
  })[0]

  // When on "All" tab, also fetch intervention jobs — the API silently excludes them
  // when active_interventions param is absent, so they'd never appear otherwise.
  const allInterventionFilter: JobFilter = {
    workflow_ids: [RFQ_WORKFLOW_ID],
    result_per_page: 50,
    page_number: 1,
    order_by: 'desc',
    sort_by: 'created_at',
    created_at_from: dateRange.from,
    created_at_to: dateRange.to,
    active_interventions: true,
  }
  const { data: allInterventionData } = useQueries({
    queries: [{
      queryKey: ['jobs', allInterventionFilter],
      queryFn: () => getJobs(allInterventionFilter),
      enabled: activeTab === 'all',
      staleTime: 15_000,
      refetchInterval: 15_000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }],
  })[0]

  // When the regular query refetches and a job disappears (transitioning into
  // intervention state), immediately refetch the intervention query so the two
  // stay in sync and the job doesn't vanish from the table.
  const prevRegularIdsRef = useRef<number[]>([])
  useEffect(() => {
    if (activeTab !== 'all') return
    const currentIds = new Set((jobsData?.jobs ?? []).map((j) => j.id))
    const disappeared = prevRegularIdsRef.current.filter((id) => !currentIds.has(id))
    if (disappeared.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['jobs', allInterventionFilter] })
    }
    prevRegularIdsRef.current = (jobsData?.jobs ?? []).map((j) => j.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsData])

  // Fetch counts for specific tabs only — "All" is computed as their sum
  const countResults = useQueries({
    queries: COUNT_TABS.map((tab) => ({
      queryKey: ['jobs', getCountFilter(tab, dateRange)],
      queryFn: () => getJobs(getCountFilter(tab, dateRange)),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  })

  const tabCounts = Object.fromEntries(
    COUNT_TABS.map((tab, i) => [tab, countResults[i].data?.total ?? 0])
  ) as Record<PipelineTab, number>

  // "All" = sum of all specific tab counts (includes pending approval jobs)
  const counts: Record<PipelineTab, number | undefined> = {
    ...tabCounts,
    all: COUNT_TABS.reduce((sum, tab) => sum + (tabCounts[tab] ?? 0), 0),
  }

  // For "All" tab: merge regular + intervention jobs, deduplicate, sort newest-first
  const jobs = (() => {
    const base = jobsData?.jobs ?? []
    if (activeTab !== 'all') return base
    const withIntervention = allInterventionData?.jobs ?? []
    const seen = new Set<number>()
    return [...withIntervention, ...base]
      .filter((j) => { if (seen.has(j.id)) return false; seen.add(j.id); return true })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  })()
  const totalPages = jobsData?.total_pages ?? 1
  const totalJobs  = counts.all ?? jobsData?.total ?? 0

  const { data: details, isLoading: detailsLoading } = useJobDetails(jobs.map((j) => j.id))

  function handleTabChange(tab: PipelineTab) {
    setActiveTab(tab)
    setPage(1)
    setSearch('')
  }

  return (
    <div>
      {/* Top controls: search + date filter + refresh */}
      <div className="pipeline-controls">
        <SearchBox value={search} onChange={setSearch} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
            {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={handleRefresh}
            title="Refresh now"
            style={{
              background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
              padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-600)',
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
          >
            ↻ Refresh
          </button>
          <DateRangeFilter value={datePreset} onChange={handleDateChange} />
        </div>
      </div>

      <FilterTabs
        active={activeTab}
        counts={counts}
        loading={countResults.some((r) => r.isLoading)}
        onChange={handleTabChange}
      />

      <PipelineTable
        jobs={jobs}
        details={details}
        detailsLoading={jobsLoading || detailsLoading}
        searchQuery={search}
      />

      {/* Pagination */}
      <div className="pagination">
        <span className="pagination-info">
          {totalJobs > 0
            ? `Showing ${Math.min((page - 1) * 10 + 1, totalJobs)}–${Math.min(page * 10, totalJobs)} of ${totalJobs}`
            : 'No results'}
        </span>
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          style={{ padding: '5px 12px', fontSize: 12 }}
        >
          ← Prev
        </Button>
        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          style={{ padding: '5px 12px', fontSize: 12 }}
        >
          Next →
        </Button>
      </div>
    </div>
  )
}
