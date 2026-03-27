export type StageFilterValue = 'all' | 'extraction' | 'rate' | 'calculation' | 'email-gen' | 'hitl' | 'sent'

const OPTIONS: Array<{ value: StageFilterValue; label: string }> = [
  { value: 'all', label: 'All Stages' },
  { value: 'extraction', label: 'Extraction' },
  { value: 'rate', label: 'Rate Fetch' },
  { value: 'calculation', label: 'Calculation' },
  { value: 'email-gen', label: 'Email Generation' },
  { value: 'hitl', label: 'HITL' },
  { value: 'sent', label: 'Sent' },
]

interface Props {
  value: StageFilterValue
  onChange: (v: StageFilterValue) => void
}

export function StageFilter({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', flexShrink: 0 }}>
        Filter:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StageFilterValue)}
        style={{ maxWidth: 180 }}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
