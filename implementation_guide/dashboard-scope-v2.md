# RFQ Dashboard — Frontend Implementation Guide v2

Every feature in this document is achievable through current platform APIs. Every feature
has a concrete implementation guide. The only exception is the email thread in the Audit
Trail — that data comes from an external source using `job.ticket_id` as the lookup key
and is not a platform API call.

See `api-auth-guide.md` in this directory for full authentication header requirements.

---

### Tool changes already deployed

The following changes have been made to `app/functions/tools/rfq_agent_tool.py` and are
live in the codebase. The frontend can rely on these without waiting for the rate API.

**`transit_days` and `validity_date` in carrier results**

Both fields now flow through `get_rate` → `price_request_items` → `calculate_final_price`
results. They appear in every carrier object in the Type 2 HITL payload and in the
`generate_quotation` input. The rate API is being updated to populate `transit_days`; until
that update is deployed the field will be `null` and the frontend should fall back to
displaying `"—"` in those positions.

**HITL forms capability deployed**

The platform now uses `HITLInterruptPayload` (`interrupt_message` on the HITL record)
for all three intervention types. The dashboard reads `interrupt_message.interaction_type`
to determine what to render and `interrupt_message.data.*` for type-specific content.

For Type 3, the quotation email HTML is in `interrupt_message.data.approval.ai_response`.
Render it in a sandboxed iframe — do not JSON.parse it.

---

### Frontend constants — tier minimums

Tier minimum margins are hardcoded in the frontend:

| Tier | Minimum margin |
|---|---|
| Gold | 8% |
| Silver | 6% |
| Bronze | 5% |

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard/insights` | GET | Aggregated job metrics for a time range |
| `/api/dashboard/jobs/` | GET | Paginated, filtered job list |
| `/api/dashboard/jobs/{job_id}` | GET | Single job — tasks, interventions, summaries |
| `/api/dashboard/hitl/{id}/action` | POST | Submit a HITL decision |
| `/api/internal/agent/run` | POST | Trigger a new agent job |

---

## HITL Intervention Types

The RFQ flow produces three HITL interventions per job in this fixed order. Every section
that involves HITL uses these types to decide what to render.

### Identifying the type

Fetch `GET /api/dashboard/jobs/{job_id}`. Find the HITL record where `status == "pending"`.
Read `hitl_record.interrupt_message.interaction_type` — no JSON parsing required.

```
interrupt_message.interaction_type == ["form"]                (step_index absent or 0) → Type 1 — Shipment Confirmation
interrupt_message.interaction_type == ["candidate_selection"]                          → Type 2 Step 0 — Carrier Selection
interrupt_message.interaction_type == ["form"]                (step_index == 1)        → Type 2 Step 1 — Price Review
interrupt_message.interaction_type == ["tool_args"]                                    → Type 3 — Email Preview
```

`interrupt_message` is the `HITLInterruptPayload` stored on the HITL record. It is
always a structured JSON object. Use `interaction_type` (and `step_index` to distinguish
Type 1 from Type 2 Step 1) as the type discriminator — never parse `ai_response`.

| Type | `interaction_type` | `step_index` | Stage in flow |
|---|---|---|---|
| **Type 1** | `["form"]` | absent / null | Agent extracted all 8 fields; reviewer corrects before rate fetch |
| **Type 2 Step 0** | `["candidate_selection"]` | `0` | Rates priced; reviewer selects one carrier from N options |
| **Type 2 Step 1** | `["form"]` | `1` | Reviewer adjusts pricing on selected carrier before quotation |
| **Type 3** | `["tool_args"]` | absent / null | Email about to send; reviewer edits subject/body and approves |

### Type 1 — what the payload contains

The agent sets `goto="get_rate"` and `confidence_score=0.9` (explicit fields) or `0.5`
(uncertain extraction) once all eight required fields are confirmed. The HITL policy fires
when `confidence_score < 0.8 AND goto == "get_rate"` and auto-approves when
`confidence_score >= 0.8`. The form data in `interrupt_message.data.form` is the
authoritative source for all shipment details across the entire dashboard for that job.

```json
{
  "interaction_type": ["form"],
  "data": {
    "form": {
      "current_values": {
        "origin": "Mumbai",
        "destination": "Dubai",
        "mode": "Air",
        "date": "2026-04-02",
        "weight_kg": 520,
        "length_cm": 80,
        "width_cm": 60,
        "height_cm": 50,
        "number_of_boxes": 4,
        "incoterms": "FOB",
        "commodity": "Electronics"
      },
      "schema": [
        { "key": "origin",          "label": "Origin",          "type": "text",   "editable": true },
        { "key": "destination",     "label": "Destination",     "type": "text",   "editable": true },
        { "key": "mode",            "label": "Mode",            "type": "select", "editable": true },
        { "key": "weight_kg",       "label": "Weight (kg)",     "type": "number", "editable": true },
        { "key": "date",            "label": "Shipment Date",   "type": "date",   "editable": true },
        { "key": "length_cm",       "label": "Length (cm)",     "type": "number", "editable": true },
        { "key": "width_cm",        "label": "Width (cm)",      "type": "number", "editable": true },
        { "key": "height_cm",       "label": "Height (cm)",     "type": "number", "editable": true },
        { "key": "number_of_boxes", "label": "Pieces",          "type": "number", "editable": true },
        { "key": "incoterms",       "label": "Incoterms",       "type": "select", "editable": true },
        { "key": "commodity",       "label": "Commodity",       "type": "text",   "editable": true }
      ],
      "resolved_options": {
        "mode": ["Air", "Surface", "Express"],
        "incoterms": ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"]
      }
    }
  },
  "context": {
    "confidence_score": 0.5,
    "summary": "All 8 shipment fields confirmed. Awaiting approval to fetch carrier rates.",
    "node_key": "rfq_agent"
  }
}
```

Use `data.form.schema` to render form fields and `data.form.current_values` to pre-fill them.
Use `data.form.resolved_options` for select field options.

HITL action IDs for Type 1: `"approved"` (confirm & fetch rates) · `"correct_and_rerun"` (correct fields and re-run extraction)

### Type 2 — what the payload contains

The agent sets `goto="generate_quotation"`, `confidence_score=1.0` after rates and prices
are calculated. The HITL policy fires because `goto == "generate_quotation"`. Type 2 is a
**2-step** policy: Step 0 is carrier candidate selection; Step 1 is a price review form on
the selected carrier. Both steps show `step_index` and `total_steps` in `interrupt_message`
for progress display.

Carrier options are surfaced via `interrupt_message.data.candidate_selection`. The `id_field`
identifies which field in each candidate object is its unique identifier.

```json
{
  "interaction_type": ["candidate_selection"],
  "data": {
    "candidate_selection": {
      "id_field": "carrier",
      "display_fields": ["carrier", "grand_total", "currency_code", "transit_days", "validity_date"],
      "source_path": "price_request_items.0.carriers",
      "options": [
        {
          "carrier": "IndiGo Cargo",
          "transit_days": 1,
          "validity_date": "2026-03-29",
          "breakdown": [...],
          "subtotal_before_markup": 2909.0,
          "subtotal": 3320.0,
          "markup_pct": 10.0,
          "markup_amount": 411.0,
          "vat_pct": 18.0,
          "vat_amount": 597.6,
          "grand_total": 3917.6,
          "currency_code": "USD"
        }
      ]
    }
  },
  "step_index": 0,
  "total_steps": 2,
  "context": {
    "confidence_score": 1.0,
    "recommendation": "IndiGo Cargo offers the best balance of cost and transit for this tier.",
    "node_key": "rfq_agent"
  }
}
```

Read candidate objects from `data.candidate_selection.options`. Use `id_field` to know
which field carries the identity value to send back as `selected_candidate_id`.

`source_path` will be `"calculate_final_price.output.results"` — this is the graph state
path the platform uses to write the selected candidate back on resume.

Each carrier object shape (inside `options`):
```json
{
  "carrier": "IndiGo Cargo",
  "transit_days": 1,
  "validity_date": "2026-03-29",
  "breakdown": [
    { "charge": "Air Freight", "basis": "Per kg", "unit_rate": 22.4, "units": 100, "amount": 2240.0 },
    { "charge": "Fuel Surcharge (FSC)", "basis": "Per kg", "unit_rate": 3.2, "units": 100, "amount": 320.0 }
  ],
  "subtotal_before_markup": 2909.0,
  "subtotal": 3320.0,
  "markup_pct": 10.0,
  "markup_amount": 411.0,
  "vat_pct": 18.0,
  "vat_amount": 597.6,
  "grand_total": 3917.6,
  "currency_code": "USD"
}
```

`transit_days` may be `null` until the rate API update is deployed — render `"—"` in that case.
`validity_date` may be `null` for the same reason — fall back to displaying the string `"—"`.

HITL action IDs for Type 2 Step 0: `"select"` (confirm selection) — read from `interrupt_message.actions`

---

**Type 2 Step 1 — price review form (second pause)**

After Step 0 completes, the platform immediately fires Step 1 — a form pause on the same
HITL policy, `step_index: 1, total_steps: 2`. By this point the platform has replaced
`calculate_final_price.output.results` with the single selected carrier dict.
Step 1 shows editable fields for `grand_total` and `transit_days` on that carrier.

```json
{
  "interaction_type": ["form"],
  "step_index": 1,
  "total_steps": 2,
  "data": {
    "form": {
      "current_values": {
        "carrier":      "IndiGo Cargo",
        "grand_total":  3917.6,
        "subtotal":     3320.0,
        "vat_amount":   597.6,
        "transit_days": 1
      },
      "schema": [
        { "key": "carrier",      "label": "Carrier",        "type": "string", "editable": false },
        { "key": "grand_total",  "label": "Grand Total",    "type": "number", "editable": true  },
        { "key": "subtotal",     "label": "Subtotal",       "type": "number", "editable": false },
        { "key": "vat_amount",   "label": "VAT",            "type": "number", "editable": false },
        { "key": "transit_days", "label": "Transit (days)", "type": "number", "editable": true  }
      ],
      "resolved_options": {}
    }
  },
  "actions": [{ "id": "confirmed", "label": "Confirm & Generate Quote", "type": "goto", "style": "primary" }],
  "context": { "confidence_score": 1.0, "node_key": "rfq_agent" }
}
```

The `carrier` field is read-only (confirmation only). `grand_total` and `transit_days` are
editable. Submit only the fields the reviewer actually changed.

HITL action IDs for Type 2 Step 1: `"confirmed"` (proceed to generate quotation)

---

### Type 3 — what the payload contains

Type 3 is a `tool_args` intervention on the `send_email` node. It fires **before** the tool
executes (not after), only when `execution_variables.email_type` is `"quotation"` or
`"apology"` (clarification emails skip HITL and send directly).

Unlike the old approval type, `tool_args` exposes the tool's arguments as **editable fields**.
The reviewer can modify the email body and subject before approving send.

```
interrupt_message.interaction_type    → ["tool_args"]
interrupt_message.data.tool_args.args.message  → email HTML body (editable)
interrupt_message.data.tool_args.args.subject  → email subject line (editable)
interrupt_message.data.tool_args.ui_schema     → field rendering hints
interrupt_message.context.summary              → plain English context note
interrupt_message.actions                      → approved · skip
```

Full payload structure:
```json
{
  "interaction_type": ["tool_args"],
  "data": {
    "tool_args": {
      "args": {
        "message": "<p>Dear Customer,</p><p>Please find attached your quotation...</p>",
        "subject": "Your Air Cargo Quotation — Mumbai to Dubai"
      },
      "ui_schema": {
        "message": { "description": "Email body (HTML)", "format": "html" },
        "subject": { "description": "Email subject line" }
      }
    }
  },
  "actions": [
    { "id": "approved", "label": "Send",        "type": "goto", "style": "primary" },
    { "id": "skip",     "label": "Don't Send",  "type": "skip", "style": "danger"  }
  ],
  "context": {
    "summary": "Quotation for Global Parts Ltd — IndiGo Cargo — USD 3,917.60",
    "node_key": "send_email"
  }
}
```

Render `data.tool_args.args.message` in a sandboxed iframe with an edit mode toggle (or
directly in a `<textarea>` for HTML editing). `subject` is a plain text input.

`send_to`, `thread_id`, `message_id`, and `type` are `InjectedToolArg` fields — they are
invisible in the HITL payload and are never shown to the reviewer.

HITL action IDs for Type 3: `"approved"` (send with current/edited args) · `"skip"` (skip tool — email not sent, job ends)

---

### HITL Form Rendering — new capability

The platform's HITL forms capability replaces static action buttons with interactive
forms at each pause. Each intervention type maps to a specific form pattern.

| Type | Form pattern | User can edit? | Submit payload |
|---|---|---|---|
| Type 1 — Shipment Confirmation | Editable field form (11 fields) | Yes — all editable fields | `{ "action": "approved", "edited_values": { ...corrected fields... } }` |
| Type 2 Step 0 — Carrier Selection | Candidate selection (N carrier cards) | No — select one carrier | `{ "action": "select", "selected_candidate_id": "<id_field value>" }` |
| Type 2 Step 1 — Price Review | Editable form (grand_total, transit_days) | Yes — editable fields only | `{ "action": "confirmed", "edited_values": { ...changed fields... } }` |
| Type 3 — Email Preview | Editable tool_args form (message + subject) | Yes — message and subject | `{ "action": "approved" }` or `{ "action": "skip" }` |

**Type 1 form rendering:**
The form is pre-filled from `interrupt_message.data.form.current_values`. All fields
are rendered from `data.form.schema` — type, label, and editability come from config.
The reviewer corrects any misextracted values and clicks "Confirm & Fetch Rates".
`edited_values` is submitted with the action — include only fields the reviewer actually
changed. The platform writes each corrected value to its `source_path` in graph state;
the agent reads the corrected values directly on resume — no prompt injection required.

**Type 2 Step 0 — candidate selection:**
The N carriers in the payload are rendered as selectable cards (radio-group pattern).
The reviewer clicks a carrier card to select it. Clicking "Select Carrier" submits
`selected_candidate_id` (the value of `options[selected][id_field]`) along with the
action ID read from `interrupt_message.actions[0].id` (which is `"select"`).

Do not compute a positional `carrier_N` from the array index. The action ID comes
from `interrupt_message.actions` as configured by the HITL policy.

After Step 0, the platform replaces `calculate_final_price.output.results` in graph
state with the single selected carrier dict and immediately fires Step 1.

**Type 2 Step 1 — price review:**
A second HITL pause fires on the same policy. `interrupt_message.step_index == 1`.
Render an editable form from `data.form.schema` pre-filled from `data.form.current_values`.
Only `grand_total` and `transit_days` have `editable: true`; `carrier`, `subtotal`,
`vat_amount` are read-only. Submit with `action: "confirmed"` and `edited_values` for any
changed fields.

**Type 3 form rendering:**
The email HTML from `data.tool_args.args.message` and the subject from
`data.tool_args.args.subject` are both editable. Render `message` in a sandboxed iframe
with an edit toggle (or HTML textarea) and `subject` as a plain text input. Use
`data.tool_args.ui_schema` for field labels and format hints (`"format": "html"` on
`message`). Submit with `action: "approved"` to send, `action: "skip"` to skip sending.

---

## Section 1 — Dashboard Page

### 1.1 Metric Cards

#### Card 1: Active RFQs

```
GET /api/dashboard/jobs/
Query: filter={
         "statuses": ["running", "queued"],
         "workflow_ids": ["<rfq_workflow_id>"],
         "result_per_page": 1
       }
```

Display: `response.total`

---

#### Card 2: Quotes Sent Today

```
GET /api/dashboard/jobs/
Query: filter={
         "statuses": ["success"],
         "workflow_ids": ["<rfq_workflow_id>"],
         "created_at_from": "<today 00:00:00 UTC ISO>",
         "created_at_to": "<today 23:59:59 UTC ISO>",
         "result_per_page": 1
       }
```

Display: `response.total`

---

#### Card 3: Pending Approvals

```
GET /api/dashboard/insights
Query: from=<today 00:00:00 UTC ISO>&to=<today 23:59:59 UTC ISO>
```

Display: `response.active_interventions`

---

### 1.2 Recent RFQs Table

**Columns:** RFQ ID · Route · Mode · Weight · Status · Received

#### Step 1 — Fetch job list

```
GET /api/dashboard/jobs/
Query: filter={
         "workflow_ids": ["<rfq_workflow_id>"],
         "result_per_page": 10,
         "sort_by": "created_at",
         "order_by": "desc"
       }
```

Each entry gives: `id`, `status`, `created_at`.

#### Step 2 — Fetch job details for all rows in parallel

```
GET /api/dashboard/jobs/{job_id}
```

Returns `hitl_records` array. Find the first record with a `completed` or
`pending` status and read `interrupt_message.interaction_type`.

#### Step 3 — Populate columns

Route, Mode, Weight come from the Type 1 HITL record's
`interrupt_message.data.form.current_values` (the editable form pre-fill values).

**If no Type 1 intervention exists yet** (job is still in extraction phase — `get_tier`
or data parsing is running and the agent has not yet produced its first structured output),
render Route, Mode, and Weight as `—`. This is expected for newly submitted jobs.

| Column | Source |
|---|---|
| RFQ ID | `job.id` as `#RFQ-<id>` |
| Route | `type1.interrupt_message.data.form.current_values.origin + " → " + .destination` · `—` if no Type 1 yet |
| Mode | `type1.interrupt_message.data.form.current_values.mode` · `—` if no Type 1 yet |
| Weight | `type1.interrupt_message.data.form.current_values.weight_kg + " kg"` · `—` if no Type 1 yet |
| Status | Derived from `job.status` + pending intervention type — see status table below |
| Received | `job.created_at` as relative time |

**Status labels:**

| `job.status` | Pending intervention | Label | Badge colour |
|---|---|---|---|
| `queued` | — | Queued | Gray |
| `running` | None | Processing | Blue |
| `running` | Type 1 | Pending — Confirm Shipment | Purple |
| `running` | Type 2 | Pending — Select Carrier | Yellow |
| `running` | Type 3 | Pending — Email Preview | Yellow |
| `success` | — | Sent | Green |
| `failed` | — | Failed | Red |
| `interrupted` | — | Interrupted | Yellow |

---

### 1.3 AI Performance Today

```
GET /api/dashboard/insights
Query: from=<today 00:00:00 UTC ISO>&to=<today 23:59:59 UTC ISO>
```

| Display label | Source |
|---|---|
| Completed today | `metrics` — item where `label == "Success"` → `.value` |
| Failed today | `metrics` — item where `label == "Failed"` → `.value` |
| Currently running | `metrics` — item where `label == "Running"` → `.value` |
| Pending approvals | `active_interventions` |

**Avg response time** — second call:

```
GET /api/dashboard/jobs/
Query: filter={
         "statuses": ["success"],
         "workflow_ids": ["<rfq_workflow_id>"],
         "created_at_from": "<today_start>",
         "created_at_to": "<today_end>",
         "result_per_page": 100
       }
```

Compute: `average(job.runtime)` across returned jobs. `runtime` is in seconds. Display as `X.X min`.

---

### 1.4 Page Load Strategy

Fire in parallel on mount:

```
1. GET /api/dashboard/insights                             → card 3 + performance metrics
2. GET /api/dashboard/jobs/ [queued+running]               → card 1
3. GET /api/dashboard/jobs/ [success, today]               → card 2
4. GET /api/dashboard/jobs/ [recent 10]                    → recent RFQs table
5. GET /api/dashboard/jobs/ [success, today, limit 100]    → avg runtime
```

After call 4 resolves, fire all per-job detail calls in parallel.

---

## Section 2 — New RFQ Form

Manual RFQ entry. Triggers a new agent job via the internal run endpoint.
The agent processes the structured form input using FORMAT A (structured data array).

### 2.1 Form Fields

| Field | Input type | Required | Payload key |
|---|---|---|---|
| Company Name | Text | Yes | `company_name` |
| Customer Email | Email | Yes | `sender_email` |
| Contact Person | Text | No | `contact_name` |
| Origin | Text | Yes | `data[0].origin` |
| Destination | Text | Yes | `data[0].destination` |
| Mode | Static label "Air" | — | `data[0].mode: "Air"` |
| Gross Weight (kg) | Number | Yes | `data[0].weight_kg` |
| Length (cm) | Number | Yes | `data[0].length_cm` |
| Width (cm) | Number | Yes | `data[0].width_cm` |
| Height (cm) | Number | Yes | `data[0].height_cm` |
| Number of Pieces | Number | Yes | `data[0].number_of_boxes` |
| Commodity Description | Text | Yes | `commodity` |
| Shipment Date | Date | Yes | `data[0].date` as `YYYY-MM-DD` |
| Special Instructions | Textarea | No | `notes` |

Mode is fixed to Air — render as a read-only label, not a dropdown.

### 2.2 Submission

```
POST /api/internal/agent/run
Headers: X-Internal-Api-Key: <key>, organisation-id: <org_id>
Body:
{
  "workflowId": <rfq_workflow_id>,
  "sender_email": "<customer_email>",
  "company_name": "<company_name>",
  "contact_name": "<contact_name>",
  "commodity": "<commodity>",
  "notes": "<special_instructions>",
  "data": [{
    "origin": "<origin>",
    "destination": "<destination>",
    "mode": "Air",
    "weight_kg": <number>,
    "date": "<YYYY-MM-DD>",
    "length_cm": <number>,
    "width_cm": <number>,
    "height_cm": <number>,
    "number_of_boxes": <number>
  }]
}
```

**Response (HTTP 202):**
```json
{
  "status": "queued",
  "job_id": 1234,
  "workflow_id": 5,
  "message": "Workflow execution queued successfully"
}
```

### 2.3 Post-Submit UI

On 202 response:
- Show success state: `"RFQ #<job_id> submitted — agent is processing"`
- Show estimate: `"Typically completes in ~4 minutes"`
- Link to Quote Pipeline filtered to this job

---

## Section 3 — Quote Pipeline

Full list of all RFQ jobs with current stage, shipment details, and available actions.

### 3.1 Filter Tabs

| Tab | Filter | Count source |
|---|---|---|
| All | No status filter | `response.total` |
| Processing | `statuses: ["queued","running"]`, `active_interventions: false` | `response.total` |
| Pending Approval | `active_interventions: true` | `response.total` |
| Sent | `statuses: ["success"]` | `response.total` |
| Failed | `statuses: ["failed","interrupted"]` | `response.total` |

The `active_interventions: false` filter on the Processing tab excludes jobs that are
technically "running" but are paused waiting for HITL. Those jobs appear under
Pending Approval instead, preventing double-counting.

Fetch all tab counts in parallel on page load using `result_per_page: 1`.

### 3.2 Search

Client-side filter on loaded rows.

**RFQ ID search** — `job.id` is an integer. The `#RFQ-` prefix is generated on the
frontend. Strip the prefix and any leading zeros from the query and match against
`job.id.toString()`. This works as soon as the job list loads — no per-job detail
call is needed.

**Customer search** — the customer string is only available after per-job detail
calls resolve (it is not in the job list response). Disable or show a loading state
on the search input until all detail calls for the current page are complete, then
enable client-side filtering against the resolved customer string.

See section 3.3 for how the customer string is resolved from `job.info`.

### 3.3 Table Columns

| Column | Source |
|---|---|
| RFQ ID | `job.id` as `#RFQ-<id>` |
| Customer | Resolved from `job.info` array — see customer resolution below |
| Route | `type1.interrupt_message.data.form.current_values.origin → .destination` · `—` if not yet available |
| Mode | `type1.interrupt_message.data.form.current_values.mode` · `—` if not yet available |
| Weight | `type1.interrupt_message.data.form.current_values.weight_kg` kg · `—` if not yet available |
| Pipeline Stage | Derived — see 3.4 |
| Agent Step | `task.title` of the currently running task in `job.tasks` |
| Received | `job.created_at` as relative time |
| Action | Context button — see 3.5 |

**Customer field resolution**

`job.info` is not a flat object. It is an array of `{label, value, meta}` pairs built
from the workflow's `input_data_fields` configuration reading from `job.input_json`.
Access it with a label lookup:

```js
const getInfo = (info, label) =>
  info?.find(f => f.label.toLowerCase() === label.toLowerCase())?.value ?? null

const customer = getInfo(job.info, "Company Name")
              ?? getInfo(job.info, "Sender Email")
              ?? "—"
```

**Prerequisite:** The RFQ workflow's `input_data_fields` config must expose `company_name`
and `sender_email` as labelled fields for them to appear in `job.info`. This is a
one-time workflow configuration step — without it, `job.info` will be empty.

**Email-triggered jobs** (inbound email, not form-submitted): `company_name` will not
be in `job.info` since it was never in the job input. Only `sender_email` will be
available. The customer column displays the email address in this case.

`get_tier` does not provide customer name — it returns only `{email, tier,
match_type, matched_rule}`. The tier is read from the `get_tier` task's
`output_json.tier` only.

Route, Mode, and Weight are only populated once the Type 1 HITL has fired. For jobs still
in the extraction phase (agent is running `get_tier` or parsing the customer email and has
not yet produced its first structured output), all three columns render as `—`. This is
normal and expected — not an error state.

### 3.4 Pipeline Stage Derivation

Apply the following checks **in order**. Stop at the first match.

```
1. Find hitl_record where status == "pending"
   Read interrupt_message.interaction_type and step_index:
      → ["form"]  AND step_index == 0 (or absent)  →  "Pending — Confirm Shipment"   PURPLE
      → ["candidate_selection"]                    →  "Pending — Select Carrier"     YELLOW
      → ["form"]  AND step_index == 1              →  "Pending — Review Pricing"     YELLOW
      → ["tool_args"]                              →  "Pending — Email Preview"      YELLOW

2. No pending intervention AND job.status == "running"
   Find task in job.tasks where status == "running" or is the latest completed task
   → task.title contains "get_tier"    →  "Extracting Details"   BLUE
   → task.title contains "get_rate"    →  "Fetching Rates"       BLUE
   → task.title contains "calculate"   →  "Calculating Quote"    BLUE
   → task.title contains "generate"    →  "Generating Email"     BLUE
   → no match                          →  "Processing"           BLUE

3. job.status == "queued"              →  "Queued"               GRAY
4. job.status == "success"             →  "Quote Sent"           GREEN
5. job.status == "failed"              →  "Failed"               RED
6. job.status == "interrupted"         →  "Interrupted"          YELLOW
```

Intervention check always comes before task title check. A job with `status == "running"`
and a pending Type 1 intervention is in "Pending — Confirm Shipment", not "Extracting
Details" — even if a `get_tier` task is still listed as running underneath it.

### 3.5 Action Buttons

| Pipeline Stage | Button | Behaviour |
|---|---|---|
| Pending — Confirm Shipment | Review | Navigate to HITL Approvals |
| Pending — Select Carrier | View Quote | Navigate to Quote Builder |
| Pending — Email Preview | Preview Email | Navigate to Email Preview page |
| Extracting Details / Fetching Rates / Calculating Quote / Generating Email | — | Spinner only, no button |
| Queued | — | Spinner only, no button |
| Quote Sent | View | Navigate to Email Audit Trail for this job |
| Failed / Interrupted | — | No action |

### 3.6 Data Fetch Strategy

```
1. GET /api/dashboard/jobs/ with active tab filter (page size 20)
2. GET /api/dashboard/jobs/{job_id} for all rows in parallel
3. Parse interventions → Pipeline Stage, Action button, Route, Mode, Weight
4. Parse job.tasks → Agent Step column
```

Pagination: use `page_number` and `result_per_page`. Show `response.total_pages`.

---

## Section 4 — Quote Builder

Read-only view of carrier options for a job at "Pending — Select Carrier" stage.
Navigated to from the Quote Pipeline or HITL Approvals pages.

### 4.1 Loading the Page

```
GET /api/dashboard/jobs/{job_id}
```

Find HITL records by `status == "pending"` or `status == "completed"`:
- `interaction_type == ["form"]` (Type 1) → context banner and summary sidebar.
  Read shipment fields from `interrupt_message.data.form.current_values`.
- `interaction_type == ["candidate_selection"]` (Type 2) → carrier cards.
  Read carriers from `interrupt_message.data.candidate_selection.options`.
- The pending Type 2 record's `id` → used for the HITL action call.

### 4.2 Context Banner

| Field | Source |
|---|---|
| RFQ reference | `#RFQ-<job.id>` |
| Customer | Label lookup on `job.info` array — `"Company Name"` then `"Sender Email"` |
| Route | Type 1 `interrupt_message.data.form.current_values.origin → .destination` |
| Mode | Type 1 `interrupt_message.data.form.current_values.mode` |
| Weight | Type 1 `interrupt_message.data.form.current_values.weight_kg` kg |
| Tier | `output_json.tier` from the task in `job.tasks` where `title` contains `"get_tier"` |
| Markup | `interrupt_message.data.candidate_selection.options[0].markup_pct`% — from Type 2 Step 0 record |

### 4.3 Carrier Cards

Source: `hitl_record.interrupt_message.data.candidate_selection.options`
(where `hitl_record` is the Type 2 record — `interaction_type == ["candidate_selection"]`)

Each carrier object shape:
```json
{
  "carrier": "IndiGo Cargo",
  "transit_days": 1,
  "validity_date": "2026-03-29",
  "breakdown": [
    { "charge": "Air Freight", "basis": "Per kg", "unit_rate": 22.4, "units": 100, "amount": 2240.0 },
    { "charge": "Fuel Surcharge (FSC)", "basis": "Per kg", "unit_rate": 3.2, "units": 100, "amount": 320.0 },
    { "charge": "Service Markup (Silver tier)", "basis": "10% of pre-markup subtotal", "unit_rate": null, "units": null, "amount": 411.0 }
  ],
  "subtotal_before_markup": 2909.0,
  "subtotal": 3320.0,
  "markup_pct": 10.0,
  "markup_amount": 411.0,
  "vat_pct": 18.0,
  "vat_amount": 597.6,
  "grand_total": 3917.6,
  "currency_code": "USD"
}
```

Each card renders:
- Carrier name + initials avatar (generated from carrier name)
- Sub-line: `Transit: <transit_days> day(s) · Validity: <validity_date formatted>` — show `—` for either field if null
- `breakdown` table with all line items
- Grand total: `grand_total` + `currency_code`

**Best Price badge:** carrier with lowest `grand_total` — computed on the frontend.

### 4.4 Margin Validation Box

Computed fields:
- Margin %: `selected_carrier.markup_pct`
- Tier minimum: hardcoded frontend constant keyed by tier (Gold: 8%, Silver: 6%, Bronze: 5%)
- Tier from: `get_tier` task `output_json.tier`
- Threshold check: `selected_carrier.grand_total > 5000` → requires HITL approval

Display format:
`"Selected carrier (<name>) yields <markup_pct>% margin — above <tier> minimum of <tier_min>%."`
Append: `"Auto-approval eligible (below $5,000 threshold)"` if `grand_total ≤ 5000`, else `"Requires HITL approval (above $5,000 threshold)"`.

### 4.5 AI Recommendation

Source: `hitl_record.interrupt_message.context.recommendation` (Type 2 record)

Display as plain text below the margin validation box.

### 4.6 Quote Summary Sidebar

Updates live when the user clicks a different carrier card. Carrier values read from
`interrupt_message.data.candidate_selection.options[selectedIndex]`.
Shipment values read from the Type 1 record's `interrupt_message.data.form.current_values`.

| Row | Source |
|---|---|
| RFQ Reference | `#RFQ-<job.id>` |
| Customer | Label lookup on `job.info` array — `"Company Name"` then `"Sender Email"` |
| Tier | `get_tier` task `output_json.tier` |
| Origin | Type 1 `data.form.current_values.origin` |
| Destination | Type 1 `data.form.current_values.destination` |
| Mode | Type 1 `data.form.current_values.mode` |
| Chargeable Weight | Type 1 `data.form.current_values.weight_kg` kg |
| Carrier | `options[selected].carrier` |
| Validity | `options[selected].validity_date` formatted · `—` if null |
| Total | `options[selected].grand_total` + `currency_code` |

### 4.7 Actions — Candidate Selection Form

The carrier cards in Section 4.3 now act as a candidate selection form. Only one
card can be selected at a time (radio-group pattern). Clicking a card:
- Highlights the selected card with a selection indicator
- Updates the Quote Summary sidebar live (Section 4.6)
- Updates the Margin Validation box (Section 4.4)

**Candidate identity — how to map selection to submission:**
The `id_field` in `interrupt_message.data.candidate_selection` names which field in
each candidate object carries its unique identity. Read it before rendering:

```js
const { options, id_field } = interrupt_message.data.candidate_selection
// e.g. id_field = "carrier"
// When user selects options[N], set:
// selected_candidate_id = options[N][id_field]  →  "IndiGo Cargo"
```

The action ID comes from `interrupt_message.actions[0].id` — read it from the payload,
do not hard-code it. The policy configures a single `"select"` action for Step 0.

The first carrier in `options` is pre-selected by default (agent's recommendation).

**Confirm selection (Step 0):**
```
POST /api/dashboard/hitl/{pending_type2_step0_hitl_record.id}/action
Body: {
  "action": "select",
  "selected_candidate_id": "<options[selected][id_field]>",
  "note": "<optional reviewer note>"
}
```

Example:
```json
{
  "action": "select",
  "selected_candidate_id": "IndiGo Cargo",
  "note": "Customer requested fastest transit option."
}
```

On submit the platform fires Step 1 immediately — the job stays interrupted with a new
HITL record for the price review form. The Quote Builder page should detect
`interrupt_message.step_index == 1` and render the price edit form (Section 4.8).

---

### 4.8 Type 2 Step 1 — Price Review Form

After Step 0 the page re-fetches the job (or receives a push update). The new pending HITL
record has `interaction_type: ["form"]`, `step_index: 1`, `total_steps: 2`.

Read the form from `interrupt_message.data.form` and render using the same editable form
pattern as Type 1 (Section 6.3). Only `grand_total` and `transit_days` are editable.

Display a step progress indicator: `Step 2 of 2 — Review Pricing`.

**Confirm & Generate Quote (Step 1):**
```
POST /api/dashboard/hitl/{pending_type2_step1_hitl_record.id}/action
Body: {
  "action": "confirmed",
  "edited_values": {
    "grand_total":  <number — only if changed>,
    "transit_days": <number — only if changed>
  },
  "note": "<optional reviewer note>"
}
```

On success navigate back to Quote Pipeline. The agent resumes, generates the
quotation email, and the Type 3 HITL fires on `send_email` before the email is sent.

---

## Section 5 — Email Preview

Read-only preview of the generated email before it is sent to the customer.
This page is reached when a Type 3 HITL intervention is pending on a job.
Navigated to from Quote Pipeline ("Preview Email" action) or HITL Approvals.

The Type 3 intervention is a `tool_args` HITL policy on the `send_email` node. It fires
**before** the tool executes, only when `execution_variables.email_type` is `"quotation"`
or `"apology"`. The `interaction_type` is `["tool_args"]`. The email HTML is in
`interrupt_message.data.tool_args.args.message`; the subject is in `.args.subject`.
Both fields are editable — the reviewer can change them before approving send.

### 5.1 Loading the Page

```
GET /api/dashboard/jobs/{job_id}
```

Find the HITL record where `status == "pending"` and
`interrupt_message.interaction_type == ["tool_args"]`.

### 5.2 Recipient (Read-only)

Source: label lookup on `job.info` array — `"Company Name"` then `"Sender Email"`.
Displayed as a read-only field. Not editable (recipient is injected by the platform,
not part of the editable tool args).

### 5.3 Subject Field (Editable)

Source: `pending_hitl_record.interrupt_message.data.tool_args.args.subject`

Plain text input pre-filled with the agent-generated subject. Reviewer can edit before sending.

### 5.4 Email Body (Editable)

Source: `pending_hitl_record.interrupt_message.data.tool_args.args.message`

HTML string. Render inside a sandboxed iframe for preview. Provide an edit toggle that
switches to an HTML `<textarea>` for inline editing. Use `ui_schema.message.format == "html"`
as the hint to apply HTML rendering mode.

### 5.5 Agent Summary

Source: `pending_hitl_record.interrupt_message.context.summary`

Displayed as a one-line context note above the preview panel.

### 5.6 Actions

**Send (with current or edited content):**
```
POST /api/dashboard/hitl/{pending_type3_hitl_record.id}/action
Body: { "action": "approved" }
```
On success: navigate to Email Audit Trail for this job.

**Don't Send** — skips tool execution, job ends:
```
POST /api/dashboard/hitl/{pending_type3_hitl_record.id}/action
Body: { "action": "skip" }
```
On success: navigate back to Quote Pipeline.

---

## Section 6 — HITL Approvals

Centralised list of all jobs waiting for human action. All three intervention types appear here.

### 6.1 Warning Banner

```
GET /api/dashboard/insights
Query: from=<today_start>&to=<today_end>
```

Display: `"<active_interventions> quotes require review"`.
Hide when `active_interventions == 0`.

### 6.2 Fetching Approval Cards

```
GET /api/dashboard/jobs/
Query: filter={ "active_interventions": true, "result_per_page": 50, "order_by": "desc" }
```

For each job fetch details:
```
GET /api/dashboard/jobs/{job_id}
```

Find the intervention where `status == "pending"`. Identify its type using
the detection logic in the HITL Intervention Types section.

---

### 6.3 Type 1 Card — Shipment Confirmation (Editable Form)

Rendered when the agent has confirmed all eight shipment fields and is waiting for a
human to approve the rate fetch. With the HITL forms capability, this card renders an
editable form so the reviewer can correct any misextracted field before the rate fetch
runs — eliminating the need for a clarification email round-trip.

**Card header:**

| Field | Source |
|---|---|
| RFQ ID + received time | `#RFQ-<job.id> · Received <job.created_at relative>` |
| Company name | Label lookup on `job.info` array — `"Company Name"` then `"Sender Email"` |
| Route + mode | `items[0].origin → items[0].destination · items[0].mode` |

**Agent Summary box:** `interrupt_message.context.summary` — displayed above the form.

**Editable form — all eight fields:**

Render using `interrupt_message.data.form.schema` for field definitions and
`interrupt_message.data.form.current_values` for pre-filled values. The schema
drives input type, label, and editability. The `resolved_options` block provides
select field option lists.

| Field key | Input type | Pre-filled from `current_values` | Required |
|---|---|---|---|
| `origin` | Text | `current_values.origin` | Yes |
| `destination` | Text | `current_values.destination` | Yes |
| `mode` | Select | `current_values.mode` | Yes |
| `weight_kg` | Number | `current_values.weight_kg` | Yes |
| `date` | Date picker | `current_values.date` | Yes |
| `length_cm` | Number | `current_values.length_cm` | Yes |
| `width_cm` | Number | `current_values.width_cm` | Yes |
| `height_cm` | Number | `current_values.height_cm` | Yes |
| `number_of_boxes` | Number | `current_values.number_of_boxes` | Yes |
| `incoterms` | Select | `current_values.incoterms` | Yes |
| `commodity` | Text | `current_values.commodity` | Yes |

Respect `schema[N].editable` — fields where `editable: false` are displayed
read-only and must not be included in `edited_values` on submit.

**Validation:** Shipment date must be today or future. Weight, dimensions, and pieces
must be positive numbers. Flag invalid values inline before submission.

**Actions:**

Confirm & Fetch Rates — submits all form field values. Only include fields the
reviewer actually changed; unchanged fields can be omitted from `edited_values`
(the platform keeps the original value for any key not present).

```
POST /api/dashboard/hitl/{pending_type1_hitl_record.id}/action
Body: {
  "action": "get_rate",
  "note": "<optional reviewer note>",
  "edited_values": {
    "origin":          "<value from form>",
    "destination":     "<value from form>",
    "mode":            "<value from form>",
    "weight_kg":       <number from form>,
    "date":            "<YYYY-MM-DD from form>",
    "length_cm":       <number from form>,
    "width_cm":        <number from form>,
    "height_cm":       <number from form>,
    "number_of_boxes": <number from form>,
    "incoterms":       "<value from form>",
    "commodity":       "<value from form>"
  }
}
```

The platform writes each `edited_values` entry back to its `source_path` in graph
state before resuming the agent. No prompt injection — the agent reads corrected
values directly from state on the next execution.

Reject — ends the job without fetching rates:
```
POST /api/dashboard/hitl/{pending_type1_hitl_record.id}/action
Body: { "action": "end" }
```

---

### 6.4 Type 2 Card — Carrier Selection (Candidate Form)

This is a candidate-type intervention: multiple carriers are presented as selectable
options. Choosing any one of them triggers the same downstream action (generate
quotation) with that carrier's data. The card renders an inline candidate selection
form — no separate Quote Builder navigation required from the approvals list.

**Card header:**

| Field | Source |
|---|---|
| RFQ ID + received time | `#RFQ-<job.id> · Received <job.created_at relative>` |
| Company name | Label lookup on `job.info` array — `"Company Name"` then `"Sender Email"` |
| Route + weight | Type 1 `interrupt_message.data.form.current_values.origin → .destination · .weight_kg kg` |
| Above threshold badge | Frontend computes: show if `options[0].grand_total > 5000` |

**Recommendation box:** `interrupt_message.context.recommendation` — displayed above the carrier cards.

**Candidate carrier cards (Step 0):**

Each carrier in `interrupt_message.data.candidate_selection.options` is rendered as a
selectable card. First carrier (index 0) is pre-selected. Clicking a card selects it
(radio-group — only one active at a time).

Each card displays:
- Carrier name + "Best Price" badge if lowest `grand_total`
- Transit: `transit_days` day(s) · Validity: `validity_date` formatted (or `—` if null)
- Grand total prominently: `grand_total` + `currency_code`
- Expandable breakdown: `markup_pct`% markup, base cost `subtotal_before_markup`
- Customer Tier + tier minimum margin inline

**Card meta (updates live when selection changes):**

All values read from `interrupt_message.data.candidate_selection.options[selectedIndex]`.

| Field | Source |
|---|---|
| Customer Tier | `get_tier` task `output_json.tier` from `job.tasks` |
| Selected Carrier | `options[selected].carrier` |
| Base Cost | `options[selected].subtotal_before_markup` |
| Markup Applied | `options[selected].markup_pct`% `(` + tier + ` min: ` + hardcoded tier minimum + `)` |
| Margin $ | `options[selected].markup_amount` |
| Total Quote Value | `options[selected].grand_total` + `currency_code` |
| Quote Validity | `options[selected].validity_date` formatted · `—` if null |

**Actions — submitting Step 0:**

Read `interrupt_message.data.candidate_selection.id_field` to determine the identity key.
Set `selected_candidate_id` to `options[selected][id_field]`.
Use the action ID from `interrupt_message.actions[0].id` (which is `"select"`).

```
POST /api/dashboard/hitl/{pending_type2_step0_record.id}/action
Body: {
  "action": "select",
  "selected_candidate_id": "<options[selected][id_field]>",
  "note": "<optional reviewer note>"
}
```

After Step 0, the job remains interrupted with a new HITL record for Step 1 (price review).
The card should transition to show the Step 1 form inline, or navigate to Quote Builder
which renders both steps.

**Note on Quote Builder navigation:**
The "View Quote" action button on the Quote Pipeline (Section 3.5) navigates to the
full-page Quote Builder (Section 4) which renders both Type 2 steps with more space.
The HITL Approvals card is a compact inline version. Both submit to the same endpoint.

---

### 6.5 Type 3 Card — Email Preview

**Card header:**

| Field | Source |
|---|---|
| RFQ ID + received time | `#RFQ-<job.id> · Received <job.created_at relative>` |
| Company name | Label lookup on `job.info` array — `"Company Name"` then `"Sender Email"` |

**Summary:** `interrupt_message.context.summary`

**Email snippet:** First 200 characters of `interrupt_message.data.tool_args.args.message`
stripped of HTML tags, displayed as a preview excerpt.

**Subject:** `interrupt_message.data.tool_args.args.subject` displayed inline.

Both the subject and body are editable via the full Email Preview page (Section 5),
navigated to via "Preview & Edit" button.

**Reviewer notes (optional):**
A plain text input mapped to `note`. Max 5 000 characters.

**Actions (from this card — no inline editing):**
```
POST /api/dashboard/hitl/{pending_type3_hitl_record.id}/action
Body: { "action": "approved", "note": "<optional reviewer note>" }   ← Send as-is

Body: { "action": "skip" }   ← Don't send — job ends
```

---

### 6.6 Post-Action Behaviour

- Optimistically remove the card from the list on action submit
- Decrement the pending approvals badge count
- On error restore the card and show an error toast

---

## Section 7 — Email Audit Trail

Per-job activity timeline combining platform task/intervention data with external email thread data.

### 7.1 Job Selector

```
GET /api/dashboard/jobs/
Query: filter={
         "workflow_ids": ["<rfq_workflow_id>"],
         "result_per_page": 50,
         "order_by": "desc"
       }
```

Render as a dropdown: `#RFQ-<id>  ·  <status>  ·  <created_at relative>`

**Filter by stage:** client-side on loaded timeline entries using task `title` (node key)
or intervention type. Stage filter options: All · Extraction · Rate Fetch · Calculation ·
Email Generation · HITL · Sent.

### 7.2 Platform Timeline Data

```
GET /api/dashboard/jobs/{job_id}
```

Use `job.tasks` and `job.hitl_records`. Merge into a single list ordered by timestamp
(`task.created_at` and `hitl_record.created_at`).

**Task entry:**

| Field | Source |
|---|---|
| Step label | `task.title` |
| Status | `task.status` |
| Runtime | `task.running_time` as `Xs` or `Xm Xs` |
| Summary | `task.summary` |
| Detail (collapsible) | `task.output_json` as formatted block |

**HITL record entry:**

Type label derived from `hitl_record.interrupt_message.interaction_type` and `step_index`:

| `interaction_type` | `step_index` | Label |
|---|---|---|
| `["form"]` | 0 or absent | "Shipment Confirmation" |
| `["candidate_selection"]` | 0 | "Carrier Selection" |
| `["form"]` | 1 | "Price Review" |
| `["tool_args"]` | — | "Email Preview" |

| Field | Source |
|---|---|
| Summary | `interrupt_message.context.summary` |
| Recommendation | `interrupt_message.context.recommendation` (if present) |
| Confidence | `interrupt_message.context.confidence_score` as percentage |
| Decision | `hitl_record.action_taken` |
| Decided by | `hitl_record.action_taken_by_user_name` |
| Decided at | `hitl_record.action_taken_at` as relative time |

### 7.3 Completion Summary

For completed jobs (`job.status == "success"`), display a summary bar at the top of the timeline:

| Field | Source |
|---|---|
| Total time | `job.runtime` formatted as `Xm Xs` |
| Auto-approved note | If no Type 2 intervention required human decision: `"Auto-approved"` · otherwise `"Manually approved"` |

### 7.4 Email Thread Data (External)

`job.ticket_id` is available from the job details response. Use this as the lookup
key to fetch the email thread from the external email service.

The thread renders inbound and outbound emails as conversation entries alongside
the platform timeline. Each email entry shows: direction (in/out), sender, timestamp,
subject, and body.

The implementation of the external fetch and rendering is defined separately from
this document as it depends on the external email service's API contract.

### 7.5 Thread Item Visual Types

| Entry type | Left accent | Avatar |
|---|---|---|
| Task — agent/LLM node | Purple | AI |
| Task — tool node | Blue | Abbreviated tool name |
| Intervention — pending | Yellow | HITL |
| Intervention — approved | Green | HITL |
| Intervention — rejected/cancelled | Red | HITL |
| Email — inbound | Gray | Customer initials |
| Email — outbound | Blue | AI |

### 7.6 Live State

For jobs with `status == "running"`:
- Pending intervention → `"Waiting for human review"` with yellow indicator as final item
- No pending intervention → `"Agent is processing…"` with spinner as final item

---

## Section 8 — Sidebar and Topbar

### 8.1 Sidebar Navigation

All nav items are static links. Badge counts are fetched on page load and
refreshed on a polling interval.

| Nav item | Links to | Badge |
|---|---|---|
| Dashboard | Dashboard page | — |
| New RFQ | New RFQ form | — |
| Quote Pipeline | Quote Pipeline page | Running + queued job count |
| HITL Approvals | HITL Approvals page | `insights.active_interventions` |
| Email Audit Trail | Audit Trail page | — |

**Pipeline badge count:**
```
GET /api/dashboard/jobs/
Query: filter={
         "statuses": ["running", "queued"],
         "workflow_ids": ["<rfq_workflow_id>"],
         "result_per_page": 1
       }
```
Display: `response.total`

**Approvals badge count:**
```
GET /api/dashboard/insights
Query: from=<today_start>&to=<today_end>
```
Display: `active_interventions`

Both badge calls share responses already fetched for Dashboard page metric cards —
no additional network calls needed if the Dashboard was recently loaded.

### 8.2 Topbar

| Element | Implementation |
|---|---|
| Page title | Frontend routing state — updates on every navigation |
| New RFQ button | Links to New RFQ form — same target as sidebar nav item |

---

## Section 9 — HITL Form Strategy

### 9.1 Overview

The three HITL interventions in the RFQ flow map to distinct form patterns enabled
by the platform's HITL forms capability:

| Intervention | Form pattern | Key interaction |
|---|---|---|
| Type 1 — Shipment Confirmation | Editable field form | Reviewer corrects any misextracted field before rate fetch |
| Type 2 — Carrier Selection | Candidate selection form | Reviewer selects one carrier from N presented options |
| Type 3 — Email Preview | Approval form (read-only) | Reviewer approves or cancels; can add a note |

This replaces the previous pattern of static action buttons with no data editing.

### 9.2 Type 1 — Editable Shipment Form

**Location:** HITL Approvals card (Section 6.3) and full-page HITL review view.

**Why this matters:**
When the agent misextracts a field from a plain-text email (e.g., wrong weight,
incorrect date), the old flow required sending a clarification email to the customer
and waiting for a reply. The editable form lets the reviewer fix the error directly,
skipping the clarification round-trip entirely.

**Data flow:**
1. Agent extracts 8 fields and sets `goto="get_rate"`, `confidence_score=0.9` (clear) or `0.5` (uncertain).
2. Dashboard renders editable form pre-filled from `interrupt_message.data.form.current_values`.
3. Reviewer edits incorrect fields and submits.
4. `edited_values` is posted alongside `action: "get_rate"`.
5. Platform writes each value to its `source_path` in graph state (no prompt injection).
6. Agent resumes and reads corrected values directly from state.

### 9.3 Type 2 — Candidate Carrier Selection + Price Review (2 steps)

**Location:** Quote Builder (Section 4) and HITL Approvals compact card (Section 6.4).

**Why candidate-type:**
All carriers in the payload are valid options. Choosing any one of them triggers the
same downstream action (generate quotation). Only the selected carrier's identity
differs between choices. This is the definition of a candidate-type intervention.

**Data flow — Step 0 (carrier selection):**
1. Agent sets `goto="generate_quotation"`, `confidence_score=1.0`. HITL policy fires.
2. Dashboard renders N selectable carrier cards. First card (index 0) is pre-selected.
3. Reviewer reviews breakdown tables, margin validation, and AI recommendation.
4. Reviewer clicks a different card to change selection (or accepts the default).
5. Clicks "Select Carrier".
6. POST body: `{ "action": "select", "selected_candidate_id": "IndiGo Cargo" }`.
   Action ID `"select"` is read from `interrupt_message.actions[0].id` — not computed from index.
7. Platform resolves candidate by identity, replaces `calculate_final_price.output.results`
   in state with the single selected carrier dict. Step 1 fires immediately.

**Data flow — Step 1 (price review):**
1. New HITL record appears with `step_index: 1`, `interaction_type: ["form"]`.
2. Dashboard renders editable form pre-filled from `data.form.current_values` on the
   selected carrier (singular dict, not a list).
3. Reviewer adjusts `grand_total` or `transit_days` if needed.
4. POST body: `{ "action": "confirmed", "edited_values": { ... } }`.
5. Platform writes edits to state. Agent resumes, generates quotation for the chosen carrier.

**Dynamic cardinality:**
Render one card per entry in `data.candidate_selection.options`. The action ID for
Step 0 is always read from `interrupt_message.actions` — never hard-coded. The platform
config determines cardinality; the dashboard just renders what it receives.

### 9.4 Type 3 — Tool Args Email Edit

**Location:** Email Preview page (Section 5) and HITL Approvals compact card (Section 6.5).

**Why `tool_args` (not approval):**
Type 3 fires as a `tool_args` HITL on the `send_email` node — before the tool executes.
The HITL policy exposes `message` (HTML body) and `subject` as editable fields, so the
reviewer can make last-minute content corrections without re-running quotation generation.
`send_to`, `thread_id`, `message_id`, and `type` are `InjectedToolArg` and are invisible.

The intervention fires only when `execution_variables.email_type in ["quotation", "apology"]`.
Clarification emails bypass this HITL and send directly.

**Data flow:**
1. `send_email` node is about to execute. Platform evaluates trigger condition.
2. `email_type` is `"quotation"` → HITL fires. Job pauses.
3. Dashboard reads `data.tool_args.args.message` and `.subject`, renders editable form.
4. Reviewer edits subject/body if needed, clicks "Send".
5. POST body: `{ "action": "approved" }`.
6. Platform executes `send_email` with the (potentially edited) args. Job completes.
   Or: POST `{ "action": "skip" }` → tool is skipped, job ends without sending.

The reviewer's inputs are: edited `message`, edited `subject`, and optional `note`.

### 9.5 HITL Action POST — Request Body Shape

```
POST /api/dashboard/hitl/{id}/action
```

All fields from `HITLActionRequest` (`app/models/hitl.py:113`):

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | Routing action ID from `interrupt_message.actions` |
| `note` | string | No | Free-text reviewer note (replaces old `note_reference`) |
| `edited_values` | object | No | Type 1 only — `{ field_key: new_value }` for corrected form fields |
| `selected_candidate_id` | string | No | Type 2 only — value of `id_field` for the chosen candidate |
| `candidate_edits` | object | No | Type 2 only — per-field edits to the selected candidate after selection |
| `instruction` | string | No | Free-text instruction for retrigger scenarios (UC-6/UC-12) |
| `data` | object | No | Catch-all; used for free-text input type responses |

**Type 1 submission — field corrections:**
```json
{
  "action": "approved",
  "note": "Corrected weight and date from shipping manifest.",
  "edited_values": {
    "weight_kg": 520,
    "date": "2026-04-15"
  }
}
```
Only include fields the reviewer actually changed. The platform writes each
`edited_values` entry directly to its `source_path` in graph state.

**Type 1 submission — correct and re-extract:**
```json
{
  "action": "correct_and_rerun",
  "edited_values": { "weight_kg": 520 },
  "instruction": "Re-extract with corrected weight."
}
```

**Type 2 Step 0 submission — candidate selection:**
```json
{
  "action": "select",
  "selected_candidate_id": "IndiGo Cargo",
  "note": "Customer requested fastest transit."
}
```
`selected_candidate_id` is the value of `interrupt_message.data.candidate_selection.id_field`
for the chosen candidate. The platform locates the candidate by identity and replaces
`calculate_final_price.output.results` in state with the single selected object.

**Type 2 Step 1 submission — price review:**
```json
{
  "action": "confirmed",
  "edited_values": { "grand_total": 3800.0 },
  "note": "Adjusted price per sales director approval."
}
```

**Type 3 submission — send email (with optional edits):**
```json
{ "action": "approved", "note": "Customer confirmed via call — proceed." }
```

**Type 3 submission — skip (don't send):**
```json
{ "action": "skip" }
```

### 9.6 Implementation Reference

All platform gaps anticipated in the initial gap analysis are resolved. See
`hitl-forms-gaps.md` for the full resolution record. Key implementation pointers:

- `app/models/hitl.py:113` — `HITLActionRequest` (the actual POST body model)
- `app/core/hitl/resume_handler.py:126` — `_apply_form_writebacks` (state writeback)
- `app/core/hitl/resume_handler.py:174` — `_apply_candidate_writebacks` (candidate selection)
- `app/core/hitl/interrupt_builder.py:47` — `build_form_data` (schema + current_values)
- `app/core/hitl/interrupt_builder.py:103` — `build_candidate_data` (options + id_field)
- `app/core/middleware/common/hitl_middleware.py:333` — `_execute_multi_step` (step loop)
- `sdd/hitl/hitl_form_use_cases.md` — authoritative use case spec
