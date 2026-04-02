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
      const dims = `${form.length_cm} x ${form.width_cm} x ${form.height_cm} cm`

      const message = [
        '<p>A request for quotation was submitted to us on your behalf.</p>',
        "<table cellpadding='4' cellspacing='0' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;'>",
        `  <tr><td><strong>Company</strong></td><td>${form.company_name}</td></tr>`,
        form.contact_name ? `  <tr><td><strong>Contact Person</strong></td><td>${form.contact_name}</td></tr>` : '',
        `  <tr><td><strong>Customer Email</strong></td><td>${form.sender_email}</td></tr>`,
        "  <tr><td colspan='2'><hr style='margin:6px 0'/></td></tr>",
        `  <tr><td><strong>Origin</strong></td><td>${form.origin}</td></tr>`,
        `  <tr><td><strong>Destination</strong></td><td>${form.destination}</td></tr>`,
        `  <tr><td><strong>Shipment Date</strong></td><td>${form.date}</td></tr>`,
        '  <tr><td><strong>Mode</strong></td><td>Air</td></tr>',
        form.incoterms ? `  <tr><td><strong>Incoterms</strong></td><td>${form.incoterms}</td></tr>` : '',
        "  <tr><td colspan='2'><hr style='margin:6px 0'/></td></tr>",
        `  <tr><td><strong>Gross Weight</strong></td><td>${form.weight_kg} kg</td></tr>`,
        `  <tr><td><strong>Number of Pieces</strong></td><td>${form.number_of_boxes}</td></tr>`,
        `  <tr><td><strong>Dimensions</strong></td><td>${dims}</td></tr>`,
        `  <tr><td><strong>Commodity</strong></td><td>${form.commodity}</td></tr>`,
        form.notes ? `  <tr><td><strong>Special Instructions</strong></td><td>${form.notes}</td></tr>` : '',
        '</table>',
      ].filter(Boolean).join('\n')

      const data = [
        form.company_name,
        form.contact_name,
        form.sender_email,
        form.origin,
        form.destination,
        form.date,
        'Air',
        form.incoterms,
        `${form.weight_kg} kg`,
        form.number_of_boxes,
        dims,
        form.commodity,
        form.notes,
      ].filter(Boolean).join(', ')

      await axios.post(SEND_EMAIL_WEBHOOK, {
        input_params: {
          type:      'Platform',
          name:      form.company_name,
          threadID:  '',
          subject:   'Request for Quotation',
          message,
          sender:    form.sender_email,
          messageID: '',
          data,
        },
        objectId:   '',
        objectType: 'Email',
        hubCode:    '',
        workflowId: String(RFQ_WORKFLOW_ID),
        source:     'n8n',
        ticketId:   '',
      })

      navigate('/pipeline')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(
        status
          ? `Network error — server responded with ${status}. Please try again.`
          : 'Could not reach the server. Check your connection and try again.'
      )
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

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
