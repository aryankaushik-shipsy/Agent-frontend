import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { RFQ_WORKFLOW_ID } from '../constants'
import { Button } from '../components/ui/Button'

const SEND_EMAIL_WEBHOOK = 'https://wbdemo.shipsy.io/webhook/send-email'

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
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [isPending, setIsPending]   = useState(false)
  const [copied, setCopied]         = useState(false)

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])
  const [submitted, setSubmitted] = useState<{ jobId: number | null; threadId: string | null } | null>(null)
  const [error, setError]         = useState<string | null>(null)

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      // Build natural-language message the agent will parse
      const dims = `${form.length_cm}x${form.width_cm}x${form.height_cm} cm`
      const message = [
        `${form.origin} to ${form.destination} on ${form.date}`,
        `${form.weight_kg} kg`,
        `${dims}, ${form.number_of_boxes} piece(s) by air`,
        form.commodity    ? `commodity: ${form.commodity}`   : '',
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
      // Response may be [{job_id, status, ...}] or [{id, threadId, labelIds}]
      const payload = Array.isArray(res.data) ? res.data[0] : res.data
      setSubmitted({
        jobId:    payload?.job_id ?? null,
        threadId: payload?.threadId ?? payload?.id ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setIsPending(false)
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
            <div className="banner-title">
              RFQ {submitted.jobId ? `#${submitted.jobId}` : ''} submitted successfully
            </div>
            <div>The agent is processing your quotation request. The RFQ entry will be visible on the dashboard in 1–2 minutes.</div>
          </div>
        </div>

        <div style={{
          marginTop: 16, padding: '14px 18px', background: 'white',
          borderRadius: 8, border: '1px solid var(--gray-100)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {submitted.jobId && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 3 }}>Job ID</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>
                  #RFQ-{submitted.jobId}
                </div>
              </div>
            )}
            {submitted.threadId && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 3 }}>Reference Number</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', letterSpacing: '0.01em' }}>
                    {submitted.threadId}
                  </span>
                  <button
                    onClick={() => handleCopy(submitted.threadId!)}
                    title="Copy reference number"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      borderRadius: 4, color: copied ? '#16a34a' : 'var(--gray-400)',
                      display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                    }}
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          <Link
            to={submitted.jobId ? `/pipeline?highlight=${submitted.jobId}` : '/pipeline'}
            className="btn btn-primary"
            style={{ fontSize: 13, flexShrink: 0 }}
          >
            Track in Pipeline →
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Link to="/pipeline" className="btn btn-ghost">
            View All Jobs
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
