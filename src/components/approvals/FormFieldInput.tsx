import { useState } from 'react'
import { formatFieldValue, looksLikeHtml } from '../../utils/hitl'
import type { FormFieldSchema, SelectOption } from '../../types/hitl'

/**
 * Editable HTML body — shows a sandboxed iframe preview by default with a
 * "Edit HTML" toggle that swaps in a monospace textarea. Covers email bodies
 * (`message` on send_email) and any other `format=html` field the policy
 * declares as editable.
 */
function HtmlBodyInput({ value, onChange, label }: { value: unknown; onChange: (v: unknown) => void; label: string }) {
  const [editing, setEditing] = useState(false)
  const html = value != null ? String(value) : ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          {editing ? 'Preview' : 'Edit HTML'}
        </button>
      </div>
      {editing ? (
        <textarea
          className="hitl-form-input"
          spellCheck={false}
          style={{
            width: '100%', minHeight: 240, resize: 'vertical',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12, tabSize: 2,
          }}
          value={html}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <iframe
          sandbox="allow-same-origin"
          srcDoc={html}
          title={label}
          style={{
            width: '100%', height: 260,
            border: '1px solid var(--gray-200)', borderRadius: 6,
            background: '#fff',
          }}
        />
      )}
    </div>
  )
}

interface Props {
  field: FormFieldSchema
  value: unknown
  onChange: (v: unknown) => void
  // For read-only fields we use the full row of current_values to format money
  // (currency_code lives alongside the amount).
  ownerValues?: Record<string, unknown>
  // Options to render for select/multiselect — merged from field.options,
  // resolved_options (dynamic), and execution_variables lookups.
  resolvedOptions?: SelectOption[]
}

// Normalize string | { label, value } into a uniform shape for rendering.
function toPair(opt: SelectOption): { label: string; value: string } {
  return typeof opt === 'string' ? { label: opt, value: opt } : opt
}

function labelFor(value: string, pairs: Array<{ label: string; value: string }>): string {
  return pairs.find((p) => p.value === value)?.label ?? value
}

// A `datepicker` with HH:mm in its format hint is a datetime picker; anything
// else is a plain date picker. Backward-compat names (`datetime`/`date`) still
// route to the same two widgets.
function isDateTime(field: FormFieldSchema): boolean {
  if (field.type === 'datetime') return true
  if (field.type === 'datepicker' && (field.format ?? '').includes('HH')) return true
  return false
}

function isBooleanLike(field: FormFieldSchema): boolean {
  return field.type === 'boolean' || field.type === 'switch' || field.type === 'checkbox'
}

function isTextLike(field: FormFieldSchema): boolean {
  return field.type === 'string' || field.type === 'text' || field.type === 'textarea' || field.type === 'email'
}

/**
 * Policy-schema-driven input renderer. Handles every field type the RFQ HITL
 * policies produce: number, select ({label,value} or plain string options),
 * multiselect (static + dynamic, with max_selections), datepicker/date/datetime
 * (format hint decides date vs datetime picker), switch/boolean (with
 * true/false labels), textarea/string (with format=markdown|code|html).
 *
 * - When `field.editable` is false (or `disabled` is true), renders a static
 *   display (HTML iframe for format=html, plain formatted value otherwise).
 * - The component is presentation-only; the parent owns state and computes
 *   diffs/edits.
 */
export function FormFieldInput({ field, value, onChange, ownerValues, resolvedOptions }: Props) {
  const rawOptions: SelectOption[] = resolvedOptions ?? field.options ?? []
  const optionPairs = rawOptions.map(toPair)
  const readOnly = !field.editable || field.disabled === true

  // ── Read-only rendering ─────────────────────────────────────────────────
  if (readOnly) {
    if ((field.format === 'html' || looksLikeHtml(value)) && typeof value === 'string' && value) {
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
    if (isBooleanLike(field)) {
      const on = value === true
      const label = on ? (field.true_label ?? 'Yes') : (field.false_label ?? 'No')
      return <span className="hitl-form-static">{label}</span>
    }
    if (field.type === 'multiselect' && Array.isArray(value)) {
      if (value.length === 0) return <span className="hitl-form-static">—</span>
      return (
        <span className="hitl-form-static">
          {value.map((v) => labelFor(String(v), optionPairs)).join(', ')}
        </span>
      )
    }
    if (field.type === 'select' && value != null) {
      return <span className="hitl-form-static">{labelFor(String(value), optionPairs)}</span>
    }
    return (
      <span className="hitl-form-static">
        {formatFieldValue(field.key, value, ownerValues)}
      </span>
    )
  }

  // ── Editable rendering by type ─────────────────────────────────────────

  if (isBooleanLike(field)) {
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

  if (field.type === 'select') {
    return (
      <select
        className="hitl-form-select"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">—</option>
        {optionPairs.map(({ label, value: v }) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'radio') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {optionPairs.map(({ label, value: v }) => (
          <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="radio"
              name={field.key}
              value={v}
              checked={String(value) === v}
              onChange={() => onChange(v)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'timepicker') {
    return (
      <input
        className="hitl-form-input"
        type="time"
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    )
  }

  if (field.type === 'multiselect') {
    const selected: string[] = Array.isArray(value) ? value.map(String) : []
    const cap = field.max_selections ?? Infinity
    function toggle(v: string) {
      const next = selected.includes(v)
        ? selected.filter((s) => s !== v)
        : [...selected, v]
      if (next.length > cap) return // over the cap — ignore
      onChange(next)
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {optionPairs.map(({ label, value: v }) => {
          const on = selected.includes(v)
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggle(v)}
              style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 999,
                border: `1px solid ${on ? '#2563eb' : 'var(--gray-200)'}`,
                background: on ? '#dbeafe' : '#fff',
                color: on ? '#1d4ed8' : 'var(--gray-700)',
                cursor: 'pointer', fontWeight: on ? 600 : 400,
              }}
            >
              {label}
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

  if (field.type === 'number') {
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

  // datepicker / date / datetime — the format hint differentiates date vs datetime
  if (field.type === 'datepicker' || field.type === 'date' || field.type === 'datetime') {
    if (isDateTime(field)) {
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
            onChange(new Date(raw).toISOString())
          }}
        />
      )
    }
    return (
      <input
        className="hitl-form-input"
        type="date"
        value={value != null ? String(value).slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    )
  }

  // HTML-body fields (e.g. email `message`) — preview by default, toggle to
  // edit. Applies regardless of the underlying type name the policy used
  // (text / textarea / string). We prefer the `format=html` hint but fall
  // back to a content sniff so a plain `type: text` leaf with HTML content
  // doesn't end up as a single-line text box showing raw `<div style="…">`.
  if (field.format === 'html' || looksLikeHtml(value)) {
    return <HtmlBodyInput value={value} onChange={onChange} label={field.label} />
  }

  // string / text / textarea / email — format hint drives sub-rendering
  if (isTextLike(field)) {
    const format = field.format
    const useTextarea = field.type === 'textarea' || format === 'textarea' || format === 'markdown' || format === 'code'
    if (!useTextarea) {
      return (
        <input
          className="hitl-form-input"
          type={field.type === 'email' ? 'email' : 'text'}
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
    const isCode = format === 'code'
    return (
      <textarea
        className="hitl-form-input"
        style={{
          width: '100%',
          minHeight: isCode ? 120 : 100,
          resize: 'vertical',
          fontFamily: isCode ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          fontSize: isCode ? 12 : undefined,
          tabSize: isCode ? 2 : undefined,
        }}
        spellCheck={isCode ? false : undefined}
        placeholder={isCode && field.language === 'json' ? '{ }' : undefined}
        value={value != null ? String(value) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  // Fallback for unknown policy types — render a plain text input so the
  // reviewer can still proceed.
  return (
    <input
      className="hitl-form-input"
      type="text"
      value={value != null ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
