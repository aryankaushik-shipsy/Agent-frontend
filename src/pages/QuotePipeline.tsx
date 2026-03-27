import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { useJobDetails } from '../hooks/useJobDetails'
import { FilterTabs, type PipelineTab } from '../components/pipeline/FilterTabs'
import { SearchBox } from '../components/pipeline/SearchBox'
import { PipelineTable } from '../components/pipeline/PipelineTable'
import { Button } from '../components/ui/Button'
import { RFQ_WORKFLOW_ID } from '../constants'
import type { JobFilter } from '../types/api'

function getFilter(tab: PipelineTab, page: number): JobFilter {
  const base: JobFilter = { workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 20, page_number: page, order_by: 'desc', sort_by: 'created_at' }
  switch (tab) {
    case 'processing': return { ...base, statuses: ['queued', 'running'], active_interventions: false }
    case 'pending':    return { ...base, active_interventions: true }
    case 'sent':       return { ...base, statuses: ['success'] }
    case 'failed':     return { ...base, statuses: ['failed', 'interrupted'] }
    default:           return base
  }
}

function getCountFilter(tab: PipelineTab): JobFilter {
  const base: JobFilter = { workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }
  switch (tab) {
    case 'processing': return { ...base, statuses: ['queued', 'running'], active_interventions: false }
    case 'pending':    return { ...base, active_interventions: true }
    case 'sent':       return { ...base, statuses: ['success'] }
    case 'failed':     return { ...base, statuses: ['failed', 'interrupted'] }
    default:           return base
  }
}

const TABS: PipelineTab[] = ['all', 'processing', 'pending', 'sent', 'failed']

export function QuotePipeline() {
  const [activeTab, setActiveTab] = useState<PipelineTab>('all')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  // Fetch jobs for current tab
  const { data: jobsData, isLoading: jobsLoading } = useQueries({
    queries: [{
      queryKey: ['jobs', getFilter(activeTab, page)],
      queryFn: () => getJobs(getFilter(activeTab, page)),
      staleTime: 30_000,
    }],
  })[0]

  // Fetch counts for all tabs in parallel
  const countResults = useQueries({
    queries: TABS.map((tab) => ({
      queryKey: ['jobs', getCountFilter(tab)],
      queryFn: () => getJobs(getCountFilter(tab)),
      staleTime: 60_000,
    })),
  })

  const counts = Object.fromEntries(
    TABS.map((tab, i) => [tab, countResults[i].data?.total])
  ) as Record<PipelineTab, number | undefined>

  const jobs = jobsData?.jobs ?? []
  const totalPages = jobsData?.total_pages ?? 1

  const { data: details, isLoading: detailsLoading } = useJobDetails(jobs.map((j) => j.id))

  function handleTabChange(tab: PipelineTab) {
    setActiveTab(tab)
    setPage(1)
    setSearch('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <SearchBox value={search} onChange={setSearch} />
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
      {totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            Page {page} of {totalPages} · {jobsData?.total ?? 0} total
          </span>
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            style={{ padding: '5px 12px', fontSize: 12 }}>
            ← Prev
          </Button>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            style={{ padding: '5px 12px', fontSize: 12 }}>
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
