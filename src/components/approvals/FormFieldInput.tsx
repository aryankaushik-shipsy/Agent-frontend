import { formatFieldValue } from '../../utils/hitl'
import type { FormFieldSchema } from '../../types/hitl'

interface Props {
  field: FormFieldSchema
  value: unknown
  onChange: (v: unknown) => void
  // For read-only fields we use the full row of current_values to format money
  // (currency_code lives alongside the amount).
  ownerValues?: Record<string, unknown>
  // Options to render for select/multiselect — merged from field.options,
  // resolved_options (dynamic), and execution_variables lookups.
  resolvedOptions?: string[]
}

/**
 * Policy-schema-driven input renderer. Handles every field type the RFQ HITL
 * policies produce today: string/text, number, date, datetime, boolean, select,
 * multiselect, plus `format` hints (markdown / textarea / html / code).
 *
 * - When `field.editable` is false, renders a static display (HTML iframe for
 *   format=html, plain formatted value otherwise).
 * - The component is presentation-only; the parent owns state and computes
 *   diffs/edits.
 */
export function FormFieldInput({ field, value, onChange, ownerValues, resolvedOptions }: Props) {
  const options = resolvedOptions ?? field.options ?? []

  // ── Read-only rendering ─────────────────────────────────────────────────
  if (!field.editable) {
    if (field.format === 'html' && typeof value === 'string' && value) {
      return (
        <iframe
          sandbox="allow-same-origin"
          srcDoc={value}
          style={{
            width: '100%', height: 200, border: '1px solid var(--gray-200)',
            borderRadius: 6, background: '#fff',
          }}
          title={field.label}
        />
      )
    }
    if (field.type === 'boolean') {
      const on = value === true
      const label = on ? (field.true_label ?? 'Yes') : (field.false_label ?? 'No')
      return <span className="hitl-form-static">{label}</span>
    }
    if (field.type === 'multiselect' && Array.isArray(value)) {
      if (value.length === 0) return <span className="hitl-form-static">—</span>
      return (
        <span className="hitl-form-static">
          {value.map((v) => String(v)).join(', ')}
        </span>
      )
    }
    return (
      <span className="hitl-form-static">
        {formatFieldValue(field.key, value, ownerValues)}
      </span>
    )
  }

  // ── Editable rendering by type ─────────────────────────────────────────
  switch (field.type) {
    case 'boolean': {
      const on = value === true
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>
            {on ? (field.true_label ?? 'Yes') : (field.false_label ?? 'No')}
          </span>
        </label>
      )
    }

    case 'select': {
      return (
        <select
          className="hitl-form-select"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">—</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )
    }

    case 'multiselect': {
      const selected: string[] = Array.isArray(value) ? value.map(String) : []
      const cap = field.max_selections ?? Infinity
      function toggle(opt: string) {
        const next = selected.includes(opt)
          ? selected.filter((v) => v !== opt)
          : [...selected, opt]
        if (next.length > cap) return // over the cap — ignore
        onChange(next)
      }
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {options.map((opt) => {
            const on = selected.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                style={{
                  padding: '4px 10px', fontSize: 12, borderRadius: 999,
                  border: `1px solid ${on ? '#2563eb' : 'var(--gray-200)'}`,
                  background: on ? '#dbeafe' : '#fff',
                  color: on ? '#1d4ed8' : 'var(--gray-700)',
                  cursor: 'pointer', fontWeight: on ? 600 : 400,
                }}
              >
                {opt}
              </button>
            )
          })}
          {cap !== Infinity && (
            <span style={{ fontSize: 11, color: 'var(--gray-500)', alignSelf: 'center' }}>
              {selected.length} / {cap}
            </span>
          )}
        </div>
      )
    }

    case 'number': {
      return (
        <input
          className="hitl-form-input"
          type="number"
          min={field.min ?? undefined}
          max={field.max ?? undefined}
          step={field.step ?? undefined}
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    }

    case 'date': {
      return (
        <input
          className="hitl-form-input"
          type="date"
          value={value != null ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    }

    case 'datetime': {
      // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" (no seconds,
      // no Z). We normalize the policy's ISO 8601 value on the way in and
      // re-serialize on the way out.
      const asLocal = value != null
        ? String(value).replace('Z', '').slice(0, 16)
        : ''
      return (
        <input
          className="hitl-form-input"
          type="datetime-local"
          value={asLocal}
          onChange={(e) => {
            const raw = e.target.value
            if (!raw) { onChange(null); return }
            // Emit ISO 8601 Z so the backend/source_path writeback matches the
            // original payload's shape.
            onChange(new Date(raw).toISOString())
          }}
        />
      )
    }

    case 'string':
    case 'text':
    default: {
      const format = field.format
      // Textarea-ish formats render multiline. Markdown and plain textarea
      // both just get a textarea; the policy controls the downstream renderer.
      if (format === 'textarea' || format === 'markdown') {
        return (
          <textarea
            className="hitl-form-input"
            style={{ width: '100%', minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }}
            value={value != null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
      if (format === 'code') {
        return (
          <textarea
            className="hitl-form-input"
            style={{
              width: '100%', minHeight: 120, resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12, tabSize: 2,
            }}
            spellCheck={false}
            placeholder={field.language === 'json' ? '{ }' : undefined}
            value={value != null ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
      return (
        <input
          className="hitl-form-input"
          type="text"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
  }
}
