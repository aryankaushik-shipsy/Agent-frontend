import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { RFQ_WORKFLOW_ID } from '../constants'
import { Button } from '../components/ui/Button'

const SEND_EMAIL_WEBHOOK = 'https://wbdemo.shipsy.io/webhook/send-email'

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

interface FormState {
  company_name: string
  sender_email: string
  contact_name: string
  origin: string
  destination: string
  incoterms: string
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
  origin: '', destination: '', incoterms: '',
  weight_kg: '', length_cm: '', width_cm: '', height_cm: '', number_of_boxes: '',
  commodity: '', date: '', notes: '',
}

export function NewRFQ() {
  const navigate = useNavigate()
  const [form, setForm]       = useState<FormState>(EMPTY)
  const [isPending, setIsPending] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const dims = `${form.length_cm}x${form.width_cm}x${form.height_cm} cm`
      const message = [
        `${form.origin} to ${form.destination} on ${form.date}`,
        `${form.weight_kg} kg`,
        `${dims}, ${form.number_of_boxes} piece(s) by air`,
        form.commodity    ? `commodity: ${form.commodity}`   : '',
        form.incoterms    ? `incoterms: ${form.incoterms}`   : '',
        form.company_name ? `company: ${form.company_name}`  : '',
        form.contact_name ? `contact: ${form.contact_name}`  : '',
        form.notes        ? `notes: ${form.notes}`           : '',
      ].filter(Boolean).join(', ')

      const res = await axios.post(SEND_EMAIL_WEBHOOK, {
        input_params: {
          type:      'Platform',
          name:      form.company_name,
          threadID:  '',
          subject:   'rfq',
          message,
          sender:    form.sender_email,
          messageID: '',
          data:      message,
        },
        objectId:   '',
        objectType: 'Email',
        hubCode:    '',
        workflowId: String(RFQ_WORKFLOW_ID),
        source:     'n8n',
        ticketId:   '',
      })

      const payload = Array.isArray(res.data) ? res.data[0] : res.data
      const jobId: number | null = payload?.job_id ?? null

      navigate('/pipeline', {
        state: {
          flash: jobId
            ? `#RFQ-${jobId} created — it will appear in the pipeline in 1–2 minutes.`
            : 'RFQ submitted — the job will appear in the pipeline in 1–2 minutes.',
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
      setIsPending(false)
    }
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
            <div className="form-group">
              <label>
                Incoterms
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)', marginLeft: 6 }}>
                  delivery obligation
                </span>
              </label>
              <select
                value={form.incoterms}
                onChange={(e) => setForm((prev) => ({ ...prev, incoterms: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">— Select Incoterms —</option>
                {INCOTERMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {isPending && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
              color: 'var(--gray-500)', flex: 1,
            }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 15, height: 15, color: '#6366f1', flexShrink: 0 }}>
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              The agent is making a quotation request on your behalf…
            </div>
          )}
          <Button variant="ghost" type="button" disabled={isPending} onClick={() => setForm(EMPTY)}>
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
