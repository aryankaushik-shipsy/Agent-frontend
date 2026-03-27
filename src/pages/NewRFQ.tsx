import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useRunAgent } from '../hooks/useRunAgent'
import { RFQ_WORKFLOW_ID } from '../constants'
import { Button } from '../components/ui/Button'

interface FormState {
  company_name: string
  sender_email: string
  contact_name: string
  origin: string
  destination: string
  weight_kg: string
  length_cm: string
  width_cm: string
  height_cm: string
  number_of_boxes: string
  commodity: string
  date: string
  notes: string
}

const EMPTY: FormState = {
  company_name: '', sender_email: '', contact_name: '',
  origin: '', destination: '',
  weight_kg: '', length_cm: '', width_cm: '', height_cm: '', number_of_boxes: '',
  commodity: '', date: '', notes: '',
}

export function NewRFQ() {
  const navigate = useNavigate()
  const { mutateAsync, isPending } = useRunAgent()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitted, setSubmitted] = useState<{ jobId: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await mutateAsync({
        workflowId: RFQ_WORKFLOW_ID,
        sender_email: form.sender_email,
        company_name: form.company_name,
        contact_name: form.contact_name || undefined,
        commodity: form.commodity,
        notes: form.notes || undefined,
        data: [{
          origin: form.origin,
          destination: form.destination,
          mode: 'Air',
          weight_kg: parseFloat(form.weight_kg),
          date: form.date,
          length_cm: parseFloat(form.length_cm),
          width_cm: parseFloat(form.width_cm),
          height_cm: parseFloat(form.height_cm),
          number_of_boxes: parseInt(form.number_of_boxes, 10),
        }],
      })
      setSubmitted({ jobId: res.job_id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
        <div className="banner banner-green">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <div className="banner-content">
            <div className="banner-title">RFQ #{submitted.jobId} submitted</div>
            <div>Agent is processing. Typically completes in ~4 minutes.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Link
            to={`/pipeline?highlight=${submitted.jobId}`}
            className="btn btn-primary"
          >
            View in Quote Pipeline
          </Link>
          <Button variant="ghost" onClick={() => { setSubmitted(null); setForm(EMPTY) }}>
            Submit Another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {error && (
        <div className="banner banner-yellow" style={{ marginBottom: 16 }}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div className="banner-content">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1 — Customer */}
        <div className="form-card">
          <div className="form-section-title">
            <span className="num">1</span>
            Customer Details
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Company Name <span className="req">*</span></label>
              <input type="text" value={form.company_name} onChange={set('company_name')} required placeholder="e.g. Acme Corp" />
            </div>
            <div className="form-group">
              <label>Customer Email <span className="req">*</span></label>
              <input type="email" value={form.sender_email} onChange={set('sender_email')} required placeholder="customer@example.com" />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input type="text" value={form.contact_name} onChange={set('contact_name')} placeholder="John Smith" />
            </div>
          </div>
        </div>

        {/* Section 2 — Shipment */}
        <div className="form-card">
          <div className="form-section-title">
            <span className="num">2</span>
            Shipment Details
          </div>
          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Origin <span className="req">*</span></label>
              <input type="text" value={form.origin} onChange={set('origin')} required placeholder="e.g. Dubai" />
            </div>
            <div className="form-group">
              <label>Destination <span className="req">*</span></label>
              <input type="text" value={form.destination} onChange={set('destination')} required placeholder="e.g. Mumbai" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Mode</label>
              <div className="static-field">Air ✈</div>
            </div>
            <div className="form-group">
              <label>Shipment Date <span className="req">*</span></label>
              <input type="date" value={form.date} onChange={set('date')} required />
            </div>
          </div>
        </div>

        {/* Section 3 — Cargo */}
        <div className="form-card">
          <div className="form-section-title">
            <span className="num">3</span>
            Cargo Details
          </div>
          <div className="form-grid-3" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Gross Weight (kg) <span className="req">*</span></label>
              <input type="number" min="0" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} required placeholder="0" />
            </div>
            <div className="form-group">
              <label>Number of Pieces <span className="req">*</span></label>
              <input type="number" min="1" step="1" value={form.number_of_boxes} onChange={set('number_of_boxes')} required placeholder="0" />
            </div>
            <div className="form-group">
              <label>Commodity <span className="req">*</span></label>
              <input type="text" value={form.commodity} onChange={set('commodity')} required placeholder="e.g. Electronics" />
            </div>
          </div>
          <div className="form-grid-3">
            <div className="form-group">
              <label>Length (cm) <span className="req">*</span></label>
              <input type="number" min="0" step="0.1" value={form.length_cm} onChange={set('length_cm')} required placeholder="0" />
            </div>
            <div className="form-group">
              <label>Width (cm) <span className="req">*</span></label>
              <input type="number" min="0" step="0.1" value={form.width_cm} onChange={set('width_cm')} required placeholder="0" />
            </div>
            <div className="form-group">
              <label>Height (cm) <span className="req">*</span></label>
              <input type="number" min="0" step="0.1" value={form.height_cm} onChange={set('height_cm')} required placeholder="0" />
            </div>
          </div>
        </div>

        {/* Section 4 — Notes */}
        <div className="form-card">
          <div className="form-section-title">
            <span className="num">4</span>
            Additional Information
          </div>
          <div className="form-group">
            <label>Special Instructions</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Any special handling requirements, hazmat notes, or customer instructions..." />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" type="button" onClick={() => setForm(EMPTY)}>
            Clear Form
          </Button>
          <Button variant="primary" type="submit" loading={isPending}>
            Submit RFQ
          </Button>
        </div>
      </form>
    </div>
  )
}
