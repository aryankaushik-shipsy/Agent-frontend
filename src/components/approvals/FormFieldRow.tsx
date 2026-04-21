import { FormFieldInput } from './FormFieldInput'
import type { FormFieldSchema, SelectOption } from '../../types/hitl'

interface Props {
  field: FormFieldSchema
  value: unknown
  onChange: (v: unknown) => void
  resolvedOptions?: SelectOption[]
  ownerValues?: Record<string, unknown>
}

/**
 * A single form row: label on the left, input + description on the right.
 *
 * `format=code` fields (rate_override_json etc.) are power-user escape
 * hatches the policy may expose. Rather than giving them equal visual weight
 * next to regular fields, we wrap them in a collapsed <details> disclosure
 * so the reviewer has to deliberately expand them. The field is still
 * policy-driven — we just don't shout about it.
 */
export function FormFieldRow({ field, value, onChange, resolvedOptions, ownerValues }: Props) {
  const isAdvanced = field.format === 'code'

  if (isAdvanced) {
    return (
      <div className="hitl-form-row hitl-form-row--advanced">
        <details>
          <summary>
            {field.label} (advanced)
          </summary>
          <div className="hitl-advanced-body">
            <FormFieldInput
              field={field}
              value={value}
              onChange={onChange}
              resolvedOptions={resolvedOptions}
              ownerValues={ownerValues}
            />
            {field.description && (
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 6 }}>
                {field.description}
              </div>
            )}
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="hitl-form-row">
      <label className="hitl-form-label">{field.label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <FormFieldInput
          field={field}
          value={value}
          onChange={onChange}
          resolvedOptions={resolvedOptions}
          ownerValues={ownerValues}
        />
        {field.description && (
          <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{field.description}</span>
        )}
      </div>
    </div>
  )
}
