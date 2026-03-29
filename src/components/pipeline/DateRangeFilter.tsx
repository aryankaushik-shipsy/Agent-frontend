import { useState } from 'react'

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom'

export interface DateRange {
  from: string   // ISO 8601, e.g. "2026-03-27T00:00:00.000Z"
  to: string
}

function pad(n: number) { return String(n).padStart(2, '0') }

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function dayEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function presetToRange(preset: DatePreset, customFrom?: string, customTo?: string): DateRange {
  const now = new Date()
  switch (preset) {
    case 'today':
      return { from: dayStart(now).toISOString(), to: dayEnd(now).toISOString() }
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      return { from: dayStart(y).toISOString(), to: dayEnd(y).toISOString() }
    }
    case 'last7': {
      const d = new Date(now); d.setDate(d.getDate() - 6)
      return { from: dayStart(d).toISOString(), to: dayEnd(now).toISOString() }
    }
    case 'last30': {
      const d = new Date(now); d.setDate(d.getDate() - 29)
      return { from: dayStart(d).toISOString(), to: dayEnd(now).toISOString() }
    }
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom + 'T00:00:00').toISOString() : dayStart(now).toISOString(),
        to:   customTo   ? new Date(customTo   + 'T23:59:59').toISOString() : dayEnd(now).toISOString(),
      }
  }
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today',     label: 'Today'     },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7',     label: 'Last 7 d'  },
  { id: 'last30',    label: 'Last 30 d' },
  { id: 'custom',    label: 'Custom'    },
]

interface Props {
  value: DatePreset
  onChange: (preset: DatePreset, range: DateRange) => void
}

export function DateRangeFilter({ value, onChange }: Props) {
  const now = new Date()
  const [customFrom, setCustomFrom] = useState(toLocalISODate(now))
  const [customTo,   setCustomTo]   = useState(toLocalISODate(now))

  function handlePreset(preset: DatePreset) {
    if (preset !== 'custom') {
      onChange(preset, presetToRange(preset))
    } else {
      onChange('custom', presetToRange('custom', customFrom, customTo))
    }
  }

  function handleCustomChange(from: string, to: string) {
    setCustomFrom(from)
    setCustomTo(to)
    onChange('custom', presetToRange('custom', from, to))
  }

  return (
    <div className="date-range-filter">
      <div className="date-preset-group">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`date-preset-btn${value === p.id ? ' active' : ''}`}
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value === 'custom' && (
        <div className="date-custom-inputs">
          <input
            type="date"
            className="date-input"
            value={customFrom}
            max={customTo}
            onChange={(e) => handleCustomChange(e.target.value, customTo)}
          />
          <span className="date-sep">→</span>
          <input
            type="date"
            className="date-input"
            value={customTo}
            min={customFrom}
            max={toLocalISODate(now)}
            onChange={(e) => handleCustomChange(customFrom, e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
