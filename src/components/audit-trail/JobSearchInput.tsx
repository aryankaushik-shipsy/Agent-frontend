import { useState, useRef, useEffect } from 'react'
import { formatRelativeTime } from '../../utils/time'
import type { Job } from '../../types/job'

interface Props {
  jobs: Job[]
  selectedId: number | null
  onChange: (id: number) => void
}

export function JobSearchInput({ jobs, selectedId, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = jobs.find((j) => j.id === selectedId)

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = query.trim()
    ? jobs.filter((j) =>
        String(j.id).includes(query.trim()) ||
        j.status.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 12)
    : jobs.slice(0, 12)

  function handleSelect(id: number) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  const statusColor: Record<string, string> = {
    success: 'var(--green-600, #16a34a)',
    failed: '#dc2626',
    running: '#2563eb',
    queued: '#737373',
    interrupted: '#d97706',
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', flexShrink: 0 }}>
        Job:
      </label>
      <div style={{ position: 'relative', width: 320 }}>
        <input
          type="text"
          placeholder={selected ? `#RFQ-${selected.id} · ${selected.status}` : 'Search by RFQ ID…'}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{
            width: '100%', padding: '7px 32px 7px 10px', fontSize: 13,
            border: '1px solid var(--gray-200)', borderRadius: 6,
            outline: 'none', background: 'white', boxSizing: 'border-box',
          }}
        />
        {/* Clear / chevron icon */}
        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: 12, pointerEvents: 'none' }}>
          {query ? '' : '▾'}
        </span>

        {open && filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100,
            background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 280, overflowY: 'auto',
          }}>
            {filtered.map((job) => (
              <div
                key={job.id}
                onMouseDown={() => handleSelect(job.id)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  background: job.id === selectedId ? 'var(--gray-50)' : 'white',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid var(--gray-50)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gray-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = job.id === selectedId ? 'var(--gray-50)' : 'white')}
              >
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>#RFQ-{job.id}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: statusColor[job.status] ?? 'var(--gray-500)', fontWeight: 500 }}>
                    {job.status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    {formatRelativeTime(job.created_at)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
