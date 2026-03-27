export type PipelineTab = 'all' | 'processing' | 'pending' | 'sent' | 'failed'

interface TabDef {
  id: PipelineTab
  label: string
}

const TABS: TabDef[] = [
  { id: 'all', label: 'All' },
  { id: 'processing', label: 'Processing' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'sent', label: 'Sent' },
  { id: 'failed', label: 'Failed' },
]

interface FilterTabsProps {
  active: PipelineTab
  counts: Record<PipelineTab, number | undefined>
  loading: boolean
  onChange: (tab: PipelineTab) => void
}

export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`filter-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {counts[tab.id] != null && (
            <span className="tab-count">{counts[tab.id]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
