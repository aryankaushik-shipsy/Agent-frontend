# RFQ Dashboard — API Authentication & Contract Guide

All requests must include the correct headers depending on the endpoint group.
There are two distinct auth schemes: **dashboard endpoints** and the **internal run endpoint**.

---

## Auth Schemes at a Glance

| Endpoint | Auth scheme | Required headers |
|---|---|---|
| `GET /api/dashboard/insights` | ProjectX user | `user-id` · `access-token` · `organisation-id` |
| `GET /api/dashboard/jobs/` | ProjectX user | `user-id` · `access-token` · `organisation-id` |
| `GET /api/dashboard/jobs/{job_id}` | ProjectX user | `user-id` · `access-token` · `organisation-id` |
| `POST /api/dashboard/hitl/{id}/action` | ProjectX user | `user-id` · `access-token` · `organisation-id` |
| `POST /api/internal/agent/run` | Internal API key | `X-Internal-Api-Key` · `organisation-id` |

---

## Dashboard Endpoints

Applies to:
- `GET /api/dashboard/insights`
- `GET /api/dashboard/jobs/`
- `GET /api/dashboard/jobs/{job_id}`
- `POST /api/dashboard/hitl/{id}/action`

**Required headers on every request:**

| Header | Type | Description |
|---|---|---|
| `user-id` | string | Logged-in employee ID |
| `access-token` | string | ProjectX access token for the logged-in user |
| `organisation-id` | string | Organisation ID the user belongs to |

All three headers are required. A missing or invalid header returns `401`.

---

## Internal Run Endpoint

Applies to:
- `POST /api/internal/agent/run`

**Required headers:**

| Header | Type | Description |
|---|---|---|
| `X-Internal-Api-Key` | string | Server-side internal API key |
| `organisation-id` | string | Organisation ID for data scoping |

No ProjectX user validation. The API key is validated server-side via HMAC comparison.
This endpoint is not intended to be called directly from the browser — route it through
a backend-for-frontend (BFF) or server action so the `X-Internal-Api-Key` is never
exposed to the client.

---

## Permission Levels

Dashboard endpoints enforce per-action permissions checked against the user's role:

| Endpoint | Required permission |
|---|---|
| `GET /api/dashboard/insights` | `agent_dashboard_read` |
| `GET /api/dashboard/jobs/` | `agent_dashboard_read` |
| `GET /api/dashboard/jobs/{job_id}` | `agent_dashboard_read` |
| `POST /api/dashboard/hitl/{id}/action` | `agent_dashboard_update` |

Users without the required permission receive `403`.

---

## Endpoint Reference

---

### GET /api/dashboard/insights

Returns summary metrics and per-agent breakdowns for a time window, plus a count of
pending human-in-the-loop (HITL) interruptions.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 UTC string | Yes | Window start |
| `to` | ISO 8601 UTC string | Yes | Window end |

**Request:**

```http
GET /api/dashboard/insights?from=2026-03-20T00:00:00Z&to=2026-03-27T23:59:59Z
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
```

**Response `200 OK`:**

```json
{
  "metrics": [
    {
      "label": "Total Tasks",
      "value": 142,
      "increment": {
        "value": 18,
        "percentage": 14.5,
        "is_positive": true,
        "styles": { "color": "#22c55e" }
      },
      "icon": "tasks",
      "styles": { "color": "#6366f1", "background_color": "#eef2ff" },
      "previous_from": "2026-03-13T00:00:00Z",
      "previous_to": "2026-03-19T23:59:59Z"
    },
    {
      "label": "Success",
      "value": 119,
      "increment": {
        "value": 12,
        "percentage": 11.2,
        "is_positive": true,
        "styles": { "color": "#22c55e" }
      },
      "icon": "check_circle",
      "styles": { "color": "#22c55e", "background_color": "#dcfce7" },
      "previous_from": "2026-03-13T00:00:00Z",
      "previous_to": "2026-03-19T23:59:59Z"
    },
    {
      "label": "Failed",
      "value": 8,
      "increment": {
        "value": -3,
        "percentage": -27.3,
        "is_positive": true,
        "styles": { "color": "#22c55e" }
      },
      "icon": "error",
      "styles": { "color": "#ef4444", "background_color": "#fee2e2" },
      "previous_from": "2026-03-13T00:00:00Z",
      "previous_to": "2026-03-19T23:59:59Z"
    },
    {
      "label": "Running",
      "value": 11,
      "increment": {
        "value": 4,
        "percentage": 57.1,
        "is_positive": false,
        "styles": { "color": "#f59e0b" }
      },
      "icon": "sync",
      "styles": { "color": "#f59e0b", "background_color": "#fef3c7" },
      "previous_from": "2026-03-13T00:00:00Z",
      "previous_to": "2026-03-19T23:59:59Z"
    },
    {
      "label": "Queued",
      "value": 4,
      "increment": {
        "value": 1,
        "percentage": 33.3,
        "is_positive": false,
        "styles": { "color": "#f59e0b" }
      },
      "icon": "queue",
      "styles": { "color": "#64748b", "background_color": "#f1f5f9" },
      "previous_from": "2026-03-13T00:00:00Z",
      "previous_to": "2026-03-19T23:59:59Z"
    }
  ],
  "active_agents": [
    {
      "id": 5,
      "name": "RFQ Agent",
      "metrics": [
        { "label": "Total Uptime",   "icon": "schedule",      "color": "#6366f1", "background_color": "#eef2ff", "value": 142 },
        { "label": "Success",        "icon": "check_circle",  "color": "#22c55e", "background_color": "#dcfce7", "value": 119 },
        { "label": "Failed",         "icon": "error",         "color": "#ef4444", "background_color": "#fee2e2", "value": 8   },
        { "label": "Running",        "icon": "sync",          "color": "#f59e0b", "background_color": "#fef3c7", "value": "83.8%" }
      ]
    }
  ],
  "inactive_agents": [],
  "active_interventions": 3
}
```

**Notes:**
- `increment.is_positive` reflects whether the change is favourable (fewer failures = positive even if the raw delta is negative).
- `active_interventions` is the count of jobs currently in `interrupted` status with at least one `pending` HITL record. The dashboard badge uses this value.

---

### GET /api/dashboard/jobs/

Returns a paginated, filterable list of RFQ job summaries.

**Query parameters:**

The entire filter object is passed as a single JSON-encoded `filter` query parameter.

| Field | Type | Default | Description |
|---|---|---|---|
| `result_per_page` | integer 1–100 | 20 | Page size |
| `page_number` | integer ≥1 | 1 | Page number |
| `statuses` | string[] | — | Filter to specific statuses (`queued`, `running`, `success`, `failed`, `interrupted`) |
| `created_at_from` | ISO 8601 string | — | Earliest `created_at` to include |
| `created_at_to` | ISO 8601 string | — | Latest `created_at` to include |
| `workflow_ids` | integer[] | — | Restrict to specific workflow IDs |
| `sort_by` | string | `created_at` | Column to sort by |
| `order_by` | `asc` \| `desc` | `desc` | Sort direction |
| `active_interventions` | boolean | — | When `true`, returns only `interrupted` jobs that have at least one pending HITL action |

**Request — page 1, all RFQ jobs:**

```http
GET /api/dashboard/jobs/?filter={"result_per_page":20,"page_number":1,"workflow_ids":[5]}
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
```

**Request — only interrupted jobs needing HITL review:**

```http
GET /api/dashboard/jobs/?filter={"result_per_page":20,"page_number":1,"workflow_ids":[5],"active_interventions":true}
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
```

**Request — jobs in a date range with a specific status:**

```http
GET /api/dashboard/jobs/?filter={"result_per_page":20,"page_number":1,"statuses":["success","failed"],"created_at_from":"2026-03-20T00:00:00Z","created_at_to":"2026-03-27T23:59:59Z"}
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
```

**Response `200 OK`:**

```json
{
  "jobs": [
    {
      "id": 1058,
      "created_at": "2026-03-27T09:14:33Z",
      "started_at": "2026-03-27T09:14:35Z",
      "completed_at": null,
      "assigned_agent": "RFQ Agent",
      "status": "interrupted",
      "workflow_id": 5,
      "runtime": null
    },
    {
      "id": 1057,
      "created_at": "2026-03-27T08:52:11Z",
      "started_at": "2026-03-27T08:52:13Z",
      "completed_at": "2026-03-27T08:53:04Z",
      "assigned_agent": "RFQ Agent",
      "status": "success",
      "workflow_id": 5,
      "runtime": 51
    },
    {
      "id": 1056,
      "created_at": "2026-03-27T07:30:00Z",
      "started_at": "2026-03-27T07:30:02Z",
      "completed_at": "2026-03-27T07:30:45Z",
      "assigned_agent": "RFQ Agent",
      "status": "failed",
      "workflow_id": 5,
      "runtime": 43
    }
  ],
  "total": 58,
  "page_number": 1,
  "result_per_page": 20
}
```

**Job status values:**

| Status | Description |
|---|---|
| `queued` | Created, waiting to be picked up by a worker |
| `running` | Agent is actively executing |
| `interrupted` | Paused at a HITL checkpoint, waiting for human action |
| `success` | Completed without errors (terminal) |
| `failed` | Execution terminated with an error |

**Notes:**
- `runtime` is seconds from `started_at` to `completed_at`; `null` while not yet complete.
- `assigned_agent` is the human-readable name of the workflow, not the workflow ID.

---

### GET /api/dashboard/jobs/{job_id}

Returns the full detail record for a single job, including input payload, result, HITL
intervention history, and token/cost accounting.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `job_id` | integer | Job ID from the list endpoint |

**Request:**

```http
GET /api/dashboard/jobs/1058
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
```

**Response `200 OK` — interrupted job at Type 2 Step 0 (carrier selection):**

```json
{
  "id": 1058,
  "organisation_id": "org_456",
  "workflow_id": 5,
  "status": "interrupted",
  "created_at": "2026-03-27T09:14:33Z",
  "started_at": "2026-03-27T09:14:35Z",
  "completed_at": null,
  "cost_usd": 0.0042,
  "tokens_in": 3120,
  "tokens_out": 841,
  "trace_id": "trace_7f3a9b2c",
  "requester": "webhook-inbound",
  "retry_count": 0,
  "max_retries": 3,
  "last_error": null,
  "input_json": {
    "sender_email": "procurement@globalparts.com",
    "company_name": "Global Parts Ltd",
    "contact_name": "Sarah Chen",
    "commodity": "Electronic components",
    "notes": "Urgent — needed before end of Q1",
    "data": [
      {
        "origin": "Shanghai",
        "destination": "Dubai",
        "mode": "Air",
        "weight_kg": 120.0,
        "date": "2026-04-02",
        "length_cm": 60.0,
        "width_cm": 40.0,
        "height_cm": 30.0,
        "number_of_boxes": 5
      }
    ]
  },
  "result": null,
  "object_id": null,
  "object_type": null,
  "hub_code": null,
  "ticket_id": null,
  "updated_at": "2026-03-27T09:15:02Z",
  "hitl_records": [
    {
      "id": 203,
      "status": "completed",
      "action_taken": "approved",
      "action_taken_at": "2026-03-27T09:14:55Z",
      "action_taken_by_user_name": "Alice Okafor",
      "note": null,
      "created_at": "2026-03-27T09:14:48Z",
      "interrupt_message": {
        "interaction_type": ["form"],
        "step_index": null,
        "total_steps": null,
        "data": {
          "form": {
            "current_values": {
              "origin": "Shanghai", "destination": "Dubai", "mode": "Air",
              "weight_kg": 120, "date": "2026-04-02",
              "length_cm": 60, "width_cm": 40, "height_cm": 30,
              "number_of_boxes": 5, "incoterms": "FOB", "commodity": "Electronics"
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
        "actions": [
          { "id": "approved",          "label": "Confirm & Fetch Rates", "type": "goto",             "style": "primary"   },
          { "id": "correct_and_rerun", "label": "Correct & Re-extract",  "type": "correct_and_rerun","style": "secondary" }
        ],
        "context": {
          "confidence_score": 0.5,
          "summary": "All 8 shipment fields confirmed. Please review before fetching rates.",
          "node_key": "rfq_agent"
        }
      }
    },
    {
      "id": 204,
      "status": "pending",
      "action_taken": null,
      "action_taken_at": null,
      "action_taken_by_user_name": null,
      "note": null,
      "created_at": "2026-03-27T09:15:02Z",
      "interrupt_message": {
        "interaction_type": ["candidate_selection"],
        "step_index": 0,
        "total_steps": 2,
        "data": {
          "candidate_selection": {
            "id_field": "carrier",
            "display_fields": ["carrier", "grand_total", "currency_code", "transit_days", "validity_date"],
            "source_path": "calculate_final_price.output.results",
            "options": [
              {
                "carrier": "FedEx International Priority",
                "transit_days": 3,
                "validity_date": "2026-04-10",
                "breakdown": [
                  { "charge": "Air Freight", "basis": "Per kg", "unit_rate": 8.5, "units": 120, "amount": 1020.0 }
                ],
                "subtotal_before_markup": 3835.0,
                "subtotal": 4027.0,
                "markup_pct": 5.0,
                "markup_amount": 192.0,
                "vat_pct": 5.0,
                "vat_amount": 201.0,
                "grand_total": 4228.0,
                "currency_code": "USD"
              },
              {
                "carrier": "Emirates SkyCargo Standard",
                "transit_days": 5,
                "validity_date": "2026-04-10",
                "breakdown": [],
                "subtotal_before_markup": 3200.0,
                "subtotal": 3360.0,
                "markup_pct": 5.0,
                "markup_amount": 160.0,
                "vat_pct": 5.0,
                "vat_amount": 168.0,
                "grand_total": 3528.0,
                "currency_code": "USD"
              }
            ]
          }
        },
        "actions": [
          { "id": "select", "label": "Select Carrier", "type": "goto", "style": "primary" }
        ],
        "context": {
          "confidence_score": 1.0,
          "recommendation": "FedEx International Priority offers the fastest transit for Gold-tier.",
          "node_key": "rfq_agent"
        }
      }
    }
  ]
}
```

**Response `200 OK` — completed job (email sent):**

```json
{
  "id": 1057,
  "organisation_id": "org_456",
  "workflow_id": 5,
  "status": "success",
  "created_at": "2026-03-27T08:52:11Z",
  "started_at": "2026-03-27T08:52:13Z",
  "completed_at": "2026-03-27T08:53:04Z",
  "cost_usd": 0.0089,
  "tokens_in": 6430,
  "tokens_out": 2210,
  "trace_id": "trace_4d1e8a7f",
  "requester": "webhook-inbound",
  "retry_count": 0,
  "max_retries": 3,
  "last_error": null,
  "input_json": {
    "sender_email": "shipping@techdelta.io",
    "company_name": "TechDelta Inc",
    "contact_name": "Marcus Rivera",
    "commodity": "Server hardware",
    "data": [
      {
        "origin": "Frankfurt",
        "destination": "Singapore",
        "mode": "Air",
        "weight_kg": 200.0,
        "date": "2026-04-05",
        "length_cm": 80.0,
        "width_cm": 60.0,
        "height_cm": 50.0,
        "number_of_boxes": 2
      }
    ]
  },
  "result": {
    "email_sent": true,
    "recipient": "shipping@techdelta.io",
    "carrier_selected": "FedEx International Priority",
    "grand_total": 3875.20,
    "currency_code": "USD"
  },
  "object_id": null,
  "object_type": null,
  "hub_code": null,
  "ticket_id": null,
  "updated_at": "2026-03-27T08:53:04Z",
  "hitl_records": [
    {
      "id": 201,
      "status": "completed",
      "action_taken": "approved",
      "action_taken_at": "2026-03-27T08:52:20Z",
      "action_taken_by_user_name": "Alice Okafor",
      "note": null,
      "created_at": "2026-03-27T08:52:13Z",
      "interrupt_message": {
        "interaction_type": ["form"],
        "step_index": null,
        "total_steps": null,
        "data": {
          "form": {
            "current_values": {
              "origin": "Frankfurt", "destination": "Singapore", "mode": "Air",
              "weight_kg": 200, "date": "2026-04-05",
              "length_cm": 80, "width_cm": 60, "height_cm": 50,
              "number_of_boxes": 2, "incoterms": "CIF", "commodity": "Server hardware"
            },
            "schema": [ { "key": "origin", "label": "Origin", "type": "text", "editable": true } ],
            "resolved_options": {}
          }
        },
        "actions": [
          { "id": "approved", "label": "Confirm & Fetch Rates", "type": "goto", "style": "primary" }
        ],
        "context": { "confidence_score": 0.9, "summary": "All 8 fields confirmed.", "node_key": "rfq_agent" }
      }
    },
    {
      "id": 202,
      "status": "completed",
      "action_taken": "select",
      "action_taken_at": "2026-03-27T08:52:50Z",
      "action_taken_by_user_name": "Alice Okafor",
      "note": "Customer prefers fastest option regardless of cost.",
      "created_at": "2026-03-27T08:52:38Z",
      "interrupt_message": {
        "interaction_type": ["candidate_selection"],
        "step_index": 0,
        "total_steps": 2,
        "data": {
          "candidate_selection": {
            "id_field": "carrier",
            "source_path": "calculate_final_price.output.results",
            "options": [
              { "carrier": "FedEx International Priority", "grand_total": 3875.20, "currency_code": "USD", "transit_days": 2 },
              { "carrier": "Lufthansa Cargo Economy",      "grand_total": 2940.00, "currency_code": "USD", "transit_days": 6 }
            ]
          }
        },
        "actions": [{ "id": "select", "label": "Select Carrier", "type": "goto", "style": "primary" }],
        "context": { "confidence_score": 1.0, "recommendation": "FedEx offers shortest transit.", "node_key": "rfq_agent" }
      }
    },
    {
      "id": 203,
      "status": "completed",
      "action_taken": "confirmed",
      "action_taken_at": "2026-03-27T08:52:55Z",
      "action_taken_by_user_name": "Alice Okafor",
      "note": null,
      "created_at": "2026-03-27T08:52:52Z",
      "interrupt_message": {
        "interaction_type": ["form"],
        "step_index": 1,
        "total_steps": 2,
        "data": {
          "form": {
            "current_values": {
              "carrier": "FedEx International Priority",
              "grand_total": 3875.20, "subtotal": 3200.0, "vat_amount": 160.0, "transit_days": 2
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
    },
    {
      "id": 204,
      "status": "completed",
      "action_taken": "approved",
      "action_taken_at": "2026-03-27T08:52:58Z",
      "action_taken_by_user_name": "Alice Okafor",
      "note": null,
      "created_at": "2026-03-27T08:52:52Z",
      "interrupt_message": {
        "interaction_type": ["tool_args"],
        "step_index": null,
        "total_steps": null,
        "data": {
          "tool_args": {
            "args": {
              "message": "<p>Dear Marcus,</p><p>Please find your quotation for Frankfurt → Singapore...</p>",
              "subject": "Your Air Cargo Quotation — Frankfurt to Singapore"
            },
            "ui_schema": {
              "message": { "description": "Email body (HTML)", "format": "html" },
              "subject": { "description": "Email subject line" }
            }
          }
        },
        "actions": [
          { "id": "approved", "label": "Send",       "type": "goto", "style": "primary" },
          { "id": "skip",     "label": "Don't Send", "type": "skip", "style": "danger"  }
        ],
        "context": {
          "summary": "Quotation for TechDelta Inc — FedEx International Priority — USD 3,875.20",
          "node_key": "send_email"
        }
      }
    }
  ]
}
```

**HITL interrupt types in the RFQ workflow:**

| Type | `interaction_type` | Trigger | Action IDs | Editable | When it appears |
|---|---|---|---|---|---|
| Type 1 | `["form"]` | `confidence_score < 0.8 AND goto == "get_rate"` | `approved` · `correct_and_rerun` | Yes — all 11 shipment fields | Before rate fetch; reviewer corrects misextracted fields |
| Type 2 Step 0 | `["candidate_selection"]` | `goto == "generate_quotation"` | `select` | No — select one carrier | Reviewer picks carrier from N options |
| Type 2 Step 1 | `["form"]` (step_index 1) | Fires immediately after Step 0 | `confirmed` | Yes — `grand_total`, `transit_days` | Reviewer adjusts pricing on selected carrier |
| Type 3 | `["tool_args"]` | `email_type in ["quotation","apology"]` on `send_email` node | `approved` · `skip` | Yes — `message` (HTML), `subject` | Reviewer edits and approves email before send |

For Type 1, include `edited_values` with any corrected field values.
For Type 2 Step 0, include `selected_candidate_id` with the value of `id_field` for the chosen carrier.
For Type 2 Step 1, include `edited_values` for any price or transit changes.
See the Request body section above for full shapes.

---

### POST /api/dashboard/hitl/{id}/action

Submits a human decision for a pending HITL intervention. Resumes the paused job.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | HITL record ID (from `hitl_records[].id` in the job detail response) |

**Request body** (`HITLActionRequest` — `app/models/hitl.py:113`):

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | string | Yes | Routing action ID from `interrupt_message.actions` |
| `note` | string | No | Free-text reviewer note (max 5 000 chars) |
| `edited_values` | object | No | Type 1 — `{ field_key: corrected_value }` for edited form fields |
| `selected_candidate_id` | string | No | Type 2 — identity value of the chosen candidate (value of `id_field`) |
| `candidate_edits` | object | No | Type 2 — per-field edits applied to the selected candidate |
| `instruction` | string | No | Retrigger instruction text (UC-6 / UC-12) |
| `data` | object | No | Catch-all; used for free-text interaction type responses |

The platform writes `edited_values` back to each field's `source_path` in graph state
and resolves `selected_candidate_id` by identity (not array position).

**Request — operator confirms shipment details with corrections (Type 1):**

```http
POST /api/dashboard/hitl/203/action
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
Content-Type: application/json

{
  "action": "approved",
  "note": "Corrected weight from 100 kg to 120 kg per shipping manifest.",
  "edited_values": {
    "weight_kg": 120,
    "date": "2026-04-15"
  }
}
```

Only include fields that were actually changed. Unchanged fields are not required.

**Request — operator selects carrier (Type 2 Step 0 candidate selection):**

```http
POST /api/dashboard/hitl/204/action
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
Content-Type: application/json

{
  "action": "select",
  "selected_candidate_id": "FedEx International Priority",
  "note": "Customer specifically requested FedEx in follow-up call."
}
```

`action` is read from `interrupt_message.actions[0].id` (configured as `"select"` by the
HITL policy). `selected_candidate_id` is the value of the candidate's `id_field`
(read from `interrupt_message.data.candidate_selection.id_field`).

**Request — operator confirms price review (Type 2 Step 1):**

```http
POST /api/dashboard/hitl/205/action
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
Content-Type: application/json

{
  "action": "confirmed",
  "edited_values": { "grand_total": 3800.0 }
}
```

**Response `200 OK`:**

```json
{
  "status": "ok",
  "message": "Action accepted. Job 1058 resumed."
}
```

**Request — operator approves email send (Type 3):**

```http
POST /api/dashboard/hitl/206/action
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
Content-Type: application/json

{
  "action": "approved"
}
```

**Response `200 OK`:**

```json
{
  "status": "ok",
  "message": "Action accepted. Job 1058 resumed."
}
```

**Request — operator skips email send (Type 3):**

```http
POST /api/dashboard/hitl/206/action
user-id: emp_123
access-token: pxt_abc...xyz
organisation-id: org_456
Content-Type: application/json

{
  "action": "skip",
  "note": "Customer withdrew the request."
}
```

**Error responses:**

| Code | Cause |
|---|---|
| `400` | `action` value not in `interrupt.actions` list, or HITL record already completed |
| `401` | Missing or invalid auth headers |
| `403` | User lacks `agent_dashboard_update` permission |
| `404` | HITL record ID not found |

---

### POST /api/internal/agent/run

Triggers a new RFQ agent job. Intended to be called from your webhook handler or BFF
after an inbound customer email is parsed — never directly from the browser.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `workflowId` | integer | Yes | ID of the RFQ workflow (e.g. `5`) |
| `sender_email` | string | Yes | Customer's email address; used for tier lookup and quotation delivery |
| `company_name` | string | No | Customer company name — included in quotation header |
| `contact_name` | string | No | Contact person name — included in quotation salutation |
| `commodity` | string | No | Description of goods being shipped |
| `notes` | string | No | Free-text notes from the customer email |
| `agentEmpId` | string | No | Internal operator ID to associate with the job |
| `data` | object[] | Yes | Array of shipment line items (see below) |

**Shipment line item fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `origin` | string | Yes | Origin city / port |
| `destination` | string | Yes | Destination city / port |
| `mode` | string | Yes | Transport mode (`Air`) |
| `weight_kg` | float | Yes | Gross weight in kilograms |
| `date` | string (YYYY-MM-DD) | Yes | Requested pickup / ship date |
| `length_cm` | float | No | Package length in centimetres |
| `width_cm` | float | No | Package width in centimetres |
| `height_cm` | float | No | Package height in centimetres |
| `number_of_boxes` | integer | No | Number of packages (default: 1) |

**Request — single-lane RFQ:**

```http
POST /api/internal/agent/run
X-Internal-Api-Key: <internal_api_key>
organisation-id: org_456
Content-Type: application/json

{
  "workflowId": 5,
  "sender_email": "procurement@globalparts.com",
  "company_name": "Global Parts Ltd",
  "contact_name": "Sarah Chen",
  "commodity": "Electronic components",
  "notes": "Urgent — needed before end of Q1",
  "data": [
    {
      "origin": "Shanghai",
      "destination": "Dubai",
      "mode": "Air",
      "weight_kg": 120.0,
      "date": "2026-04-02",
      "length_cm": 60.0,
      "width_cm": 40.0,
      "height_cm": 30.0,
      "number_of_boxes": 5
    }
  ]
}
```

**Request — multi-lane RFQ (two shipment items):**

```http
POST /api/internal/agent/run
X-Internal-Api-Key: <internal_api_key>
organisation-id: org_456
Content-Type: application/json

{
  "workflowId": 5,
  "sender_email": "procurement@globalparts.com",
  "company_name": "Global Parts Ltd",
  "contact_name": "Sarah Chen",
  "commodity": "Electronic components",
  "notes": "Urgent — needed before end of Q1",
  "data": [
    {
      "origin": "Shanghai",
      "destination": "Dubai",
      "mode": "Air",
      "weight_kg": 120.0,
      "date": "2026-04-02",
      "length_cm": 60.0,
      "width_cm": 40.0,
      "height_cm": 30.0,
      "number_of_boxes": 5
    },
    {
      "origin": "Shenzhen",
      "destination": "Dubai",
      "mode": "Air",
      "weight_kg": 45.0,
      "date": "2026-04-02",
      "length_cm": 30.0,
      "width_cm": 25.0,
      "height_cm": 20.0,
      "number_of_boxes": 3
    }
  ]
}
```

**Response `202 Accepted`:**

```json
{
  "status": "queued",
  "message": "Workflow execution queued successfully",
  "job_id": 1058,
  "workflow_id": 5,
  "organisation_id": "org_456"
}
```

**Error responses:**

| Code | Cause |
|---|---|
| `400` | Malformed body or missing required fields |
| `401` | Missing `X-Internal-Api-Key` header |
| `403` | `X-Internal-Api-Key` HMAC validation failed |
| `404` | `workflowId` not found for this organisation |

---

## End-to-End RFQ Workflow

The diagram below shows how the five endpoints sequence together for a typical
multi-carrier quotation with two HITL checkpoints.

```
BFF / Webhook handler
│
│  1. Inbound customer email parsed
│
└─► POST /api/internal/agent/run
      workflowId: 5, sender_email, data[...]
      ◄── 202 { job_id: 1058, status: "queued" }
                │
                │  rfq_agent (Turn 1) extracts 8 fields → pauses at Type 1 HITL
                ▼
          Job 1058 → status: "interrupted"
          hitl_records[0].interrupt_message.interaction_type: ["form"]
          hitl_records[0].interrupt_message.data.form.current_values: { origin, destination, ... }

Operator reviews extracted fields (HITL Approvals or inline)
│
└─► POST /api/dashboard/hitl/203/action
      { "action": "approved", "edited_values": { "weight_kg": 120 } }
      ◄── 200 { status: "ok" }
                │
                │  get_tier → get_rate → calculate_final_price run automatically
                │  rfq_agent (Turn 2) sets goto="generate_quotation" → Type 2 Step 0 fires
                ▼
          Job 1058 → status: "interrupted"
          hitl_records[1].interrupt_message.interaction_type: ["candidate_selection"]
          hitl_records[1].interrupt_message.step_index: 0, total_steps: 2

Operator selects carrier
│
└─► POST /api/dashboard/hitl/204/action
      { "action": "select", "selected_candidate_id": "FedEx International Priority" }
      ◄── 200 { status: "ok" }
                │
                │  Platform writes selected carrier to state → Type 2 Step 1 fires
                ▼
          Job 1058 → status: "interrupted"
          hitl_records[2].interrupt_message.interaction_type: ["form"]
          hitl_records[2].interrupt_message.step_index: 1, total_steps: 2

Operator reviews / adjusts pricing
│
└─► POST /api/dashboard/hitl/205/action
      { "action": "confirmed", "edited_values": {} }
      ◄── 200 { status: "ok" }
                │
                │  generate_quotation runs → send_email node reached
                │  email_type == "quotation" → Type 3 HITL fires before send
                ▼
          Job 1058 → status: "interrupted"
          hitl_records[3].interrupt_message.interaction_type: ["tool_args"]
          hitl_records[3].interrupt_message.data.tool_args.args.message: "<html>..."
          hitl_records[3].interrupt_message.data.tool_args.args.subject: "Your Quotation..."

Operator reviews and optionally edits email, then approves
│
└─► GET /api/dashboard/jobs/1058          ← re-fetch to get HITL record id
└─► POST /api/dashboard/hitl/206/action
      { "action": "approved" }
      ◄── 200 { status: "ok" }
                │
                │  send_email executes with approved args → job completes
                ▼
          Job 1058 → status: "success"
          result: { email_sent: true, carrier_selected: "FedEx ...", grand_total: 3875.20 }
```

---

## RFQ Agent — Tier & Pricing Reference

The agent resolves the customer's service tier from `sender_email` and applies a fixed
markup before computing the grand total.

| Tier | Markup | Resolved from |
|---|---|---|
| `gold` | 5% | Tier API lookup on `sender_email` |
| `silver` | 10% | Tier API lookup on `sender_email` |
| `base` | 15% | Default if tier not found |

**Charge breakdown structure** (per carrier, per shipment item):

```json
{
  "carrier": "FedEx International Priority",
  "weight_kg": 120.0,
  "transit_days": 3,
  "validity_date": "2026-04-10",
  "breakdown": [
    { "charge": "Air Freight",                   "basis": "per kg",   "unit_rate": 4.20,  "units": 120.0, "amount": 504.00 },
    { "charge": "Fuel Surcharge",                "basis": "per kg",   "unit_rate": 0.85,  "units": 120.0, "amount": 102.00 },
    { "charge": "Security Surcharge",            "basis": "per kg",   "unit_rate": 0.15,  "units": 120.0, "amount": 18.00  },
    { "charge": "Airport Handling (Origin)",     "basis": "per kg",   "unit_rate": 0.30,  "units": 120.0, "amount": 36.00  },
    { "charge": "Airport Handling (Dest)",       "basis": "per kg",   "unit_rate": 0.25,  "units": 120.0, "amount": 30.00  },
    { "charge": "Customs Clearance (Origin)",    "basis": "flat",     "unit_rate": null,  "units": null,  "amount": 45.00  },
    { "charge": "Customs Clearance (Dest)",      "basis": "flat",     "unit_rate": null,  "units": null,  "amount": 60.00  },
    { "charge": "AWB Fee",                       "basis": "flat",     "unit_rate": null,  "units": null,  "amount": 25.00  },
    { "charge": "Insurance (1.5%)",              "basis": "% subtotal","unit_rate": 1.5,  "units": null,  "amount": 12.30  }
  ],
  "subtotal_before_markup": 832.30,
  "markup_pct": 5.0,
  "markup_amount": 41.62,
  "subtotal": 873.92,
  "vat_pct": 5.0,
  "vat_amount": 43.70,
  "grand_total": 917.62,
  "currency_code": "USD"
}
```
