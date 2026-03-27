import { formatRelativeTime } from '../../utils/time'
import type { Job } from '../../types/job'

interface Props {
  jobs: Job[]
  selectedId: number | null
  onChange: (id: number) => void
}

export function JobSelector({ jobs, selectedId, onChange }: Props) {
  return (
    <div className="job-selector-wrap">
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', flexShrink: 0 }}>
        Job:
      </label>
      <select
        value={selectedId ?? ''}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ maxWidth: 440 }}
      >
        <option value="" disabled>Select a job…</option>
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            #RFQ-{job.id} · {job.status} · {formatRelativeTime(job.created_at)}
          </option>
        ))}
      </select>
    </div>
  )
}
