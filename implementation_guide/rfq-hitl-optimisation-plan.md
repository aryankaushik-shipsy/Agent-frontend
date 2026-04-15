# RFQ Flow — HITL Optimisation Plan

This document covers the architecture change that replaces the current positional
`carrier_1` / `carrier_2` graph nodes and agent-driven `hitl_actions` with declarative
HITL policies. It includes the full policy JSON and curl commands for every policy that
needs to be created and attached.

---

## 1. Architecture Summary

### What changes

| Item                  | Before                                                | After                                                        |
| -----------------------| -------------------------------------------------------| --------------------------------------------------------------|
| Carrier selection     | Positional nodes `carrier_1`, `carrier_2`             | Single `carrier_selection` HITL policy on `rfq_agent`        |
| HITL trigger logic    | Agent prompt sets `confidence_score` + `hitl_actions` | Declarative `trigger_conditions` in policy config            |
| Calculate final price | Agent calls tool internally                           | Separate `tool_node` in workflow graph                       |
| Shipment field review | No HITL — agent re-extracts on clarification loop     | HITL Type 1 form fires when confidence < 0.8                 |
| Email review          | No HITL before send                                   | HITL Type 3 tool_args fires for quotation and apology emails |

### New flow

```
rfq_agent (Turn 1: extract)
  └─ HITL Type 1 (form, all 8 fields)  ← fires when confidence_score < 0.8
  goto: get_rate | send_email (clarification)

get_tier → get_rate → calculate_final_price
  └─→ rfq_agent (Turn 2: rate review supervisor)
        └─ HITL Type 2 (2-step: pick carrier → edit price)  ← fires when goto="generate_quotation"
        goto: generate_quotation | send_email (apology)

generate_quotation → send_email
  └─ HITL Type 3 (tool_args: review email before send)  ← fires when email_type in [quotation, apology]
```

### Nodes removed

`carrier_1`, `carrier_2` — both removed from the workflow graph.

### Platform fix required (Type 3 conditional trigger)

The tool_args HITL path currently fires unconditionally (no trigger evaluation in `before_node`).
A small change is required in `hitl_middleware.py` to evaluate `trigger_conditions` and
`auto_approve_rules` against graph state before intercepting tool execution. Details in §6.

---

## 2. HITL Type 1 — Shipment Confirmation

**Attaches to:** `rfq_agent` node  
**Fires:** After Turn 1, when `confidence_score < 0.8` AND `goto == "get_rate"`  
**Auto-approved:** When `confidence_score >= 0.8`  
**Steps:** 1 — form with all 8 shipment fields  
**Actions:** Confirm (approved goto) · Correct & Re-extract (correct_and_rerun)

### Step 1: Create the policy

```bash
curl -X POST "https://your-api-base/api/dashboard/policies/" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RFQ — Shipment Confirmation (Type 1)",
    "category": "hitl",
    "description": "Presents extracted shipment fields for human review and correction before rate fetch. Fires when the rfq_agent extraction confidence is below 0.8.",
    "config_json": {
      "id": "rfq_type1_shipment_confirmation",
      "priority": 1,
      "title": "Confirm Shipment Details",
      "description": "Review and correct the fields extracted from the customer email before fetching rates.",
      "urgency": "medium",
      "trigger_conditions": {
        "operator": "and",
        "conditions": [
          { "metric": "confidence_score", "operator": "lt", "threshold": 0.8 },
          { "metric": "goto", "operator": "eq", "threshold": "get_rate" }
        ]
      },
      "auto_approve_rules": [
        { "metric": "confidence_score", "operator": "gte", "threshold": 0.8 }
      ],
      "show_ai_recommendation": true,
      "rejection_action": "fail",
      "steps": [
        {
          "name": "confirm_shipment",
          "order": 0,
          "title": "Confirm Extracted Shipment Details",
          "description": "Review the fields below. Edit any incorrect value, then confirm to proceed to rate fetch.",
          "interaction_type": ["form"],
          "form": {
            "value_mappings": [
              {
                "field": "origin",
                "label": "Origin",
                "source_path": "rfq_agent.output.response.items.0.origin",
                "editable": true,
                "type": "string",
                "required": true
              },
              {
                "field": "destination",
                "label": "Destination",
                "source_path": "rfq_agent.output.response.items.0.destination",
                "editable": true,
                "type": "string",
                "required": true
              },
              {
                "field": "mode",
                "label": "Mode of Transport",
                "source_path": "rfq_agent.output.response.items.0.mode",
                "editable": true,
                "type": "select",
                "required": true,
                "options": ["Air", "Surface", "Express"]
              },
              {
                "field": "weight_kg",
                "label": "Weight (kg)",
                "source_path": "rfq_agent.output.response.items.0.weight_kg",
                "editable": true,
                "type": "number",
                "required": true,
                "min": 0.1
              },
              {
                "field": "date",
                "label": "Shipment Date",
                "source_path": "rfq_agent.output.response.items.0.date",
                "editable": true,
                "type": "date",
                "required": true
              },
              {
                "field": "length_cm",
                "label": "Length (cm)",
                "source_path": "rfq_agent.output.response.items.0.length_cm",
                "editable": true,
                "type": "number",
                "required": true,
                "min": 0.1
              },
              {
                "field": "width_cm",
                "label": "Width (cm)",
                "source_path": "rfq_agent.output.response.items.0.width_cm",
                "editable": true,
                "type": "number",
                "required": true,
                "min": 0.1
              },
              {
                "field": "height_cm",
                "label": "Height (cm)",
                "source_path": "rfq_agent.output.response.items.0.height_cm",
                "editable": true,
                "type": "number",
                "required": true,
                "min": 0.1
              },
              {
                "field": "number_of_boxes",
                "label": "Number of Boxes / Pieces",
                "source_path": "rfq_agent.output.response.items.0.number_of_boxes",
                "editable": true,
                "type": "number",
                "required": true,
                "min": 1
              },
              {
                "field": "incoterms",
                "label": "Incoterms",
                "source_path": "rfq_agent.output.response.items.0.incoterms",
                "editable": true,
                "type": "select",
                "required": true,
                "options": ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"]
              },
              {
                "field": "commodity",
                "label": "Commodity",
                "source_path": "rfq_agent.output.response.items.0.commodity",
                "editable": true,
                "type": "select",
                "required": true,
                "options": [
                  "General Cargo",
                  "Food & Perishables",
                  "Liquid Goods",
                  "Pharmaceuticals",
                  "Electronics",
                  "Garments",
                  "Dangerous Goods"
                ]
              }
            ]
          },
          "actions": {
            "source": "policy",
            "items": [
              {
                "id": "approved",
                "label": "Confirm & Fetch Rates",
                "type": "goto",
                "style": "primary",
                "confirm_required": false
              },
              {
                "id": "correct_and_rerun",
                "label": "Correct & Re-extract",
                "type": "correct_and_rerun",
                "style": "secondary",
                "confirm_required": false
              }
            ]
          },
          "require_note": false,
          "show_ai_recommendation": true
        }
      ],
      "timeout": {
        "duration_seconds": 7200,
        "action": "auto_approve",
        "warn_before_seconds": 600
      },
      "constraints": {
        "require_note": false,
        "note_label": "Correction notes (optional)",
        "note_max_length": 1000
      },
      "audit": {
        "capture_old_values": true,
        "expose_in_payload": false
      }
    }
  }'
```

### Step 2: Attach to rfq_agent node

```bash
# Replace <policy_id_type1> with the id returned from the create call above
# Replace <rfq_agent_node_id> with the workflow_node id for the rfq_agent node

curl -X POST "https://your-api-base/api/dashboard/policies/<policy_id_type1>/attach" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_node_id": <rfq_agent_node_id>,
    "priority": 1,
    "merge_strategy": "override"
  }'
```

---

## 3. HITL Type 2 — Carrier Selection (2-step)

**Attaches to:** `rfq_agent` node  
**Fires:** After Turn 2, when `goto == "generate_quotation"` (carriers found)  
**Steps:**
- Step 0: Candidate selection — user picks one carrier from all options
- Step 1: Price edit form — user reviews and optionally adjusts the selected carrier's price and transit time

After Step 0 writeback, `calculate_final_price.output.results` becomes a single carrier dict.
Step 1 reads from that dict directly using dot-path source_paths.

### Step 1: Create the policy

```bash
curl -X POST "https://your-api-base/api/dashboard/policies/" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RFQ — Carrier Selection (Type 2)",
    "category": "hitl",
    "description": "Two-step intervention: first the reviewer selects a carrier, then reviews and optionally adjusts the selected carrier pricing before generating the quotation.",
    "config_json": {
      "id": "rfq_type2_carrier_selection",
      "priority": 1,
      "title": "Carrier Selection",
      "description": "Select a carrier and confirm pricing before generating the quotation.",
      "urgency": "high",
      "trigger_conditions": {
        "metric": "goto",
        "operator": "eq",
        "threshold": "generate_quotation"
      },
      "show_ai_recommendation": true,
      "rejection_action": "fail",
      "steps": [
        {
          "name": "select_carrier",
          "order": 0,
          "title": "Select Carrier",
          "description": "Choose the carrier to include in the quotation. All available carriers and their pricing are shown below.",
          "interaction_type": ["candidate_selection"],
          "candidates": {
            "source_path": "calculate_final_price.output.results",
            "id_field": "carrier",
            "display_fields": [
              "carrier",
              "grand_total",
              "subtotal",
              "vat_amount",
              "transit_days",
              "validity_date"
            ]
          },
          "actions": {
            "source": "policy",
            "items": [
              {
                "id": "select",
                "label": "Select Carrier",
                "type": "goto",
                "style": "primary",
                "confirm_required": false,
                "candidates": {
                  "required": true,
                  "editable_fields": []
                }
              }
            ]
          },
          "require_note": false,
          "show_ai_recommendation": false
        },
        {
          "name": "edit_carrier_price",
          "order": 1,
          "title": "Review & Adjust Carrier Pricing",
          "description": "The selected carrier pricing is shown below. You may adjust the grand total or transit days before generating the quotation.",
          "interaction_type": ["form"],
          "form": {
            "value_mappings": [
              {
                "field": "carrier",
                "label": "Carrier",
                "source_path": "calculate_final_price.output.results.carrier",
                "editable": false,
                "type": "string"
              },
              {
                "field": "subtotal",
                "label": "Subtotal (USD)",
                "source_path": "calculate_final_price.output.results.subtotal",
                "editable": false,
                "type": "number"
              },
              {
                "field": "vat_amount",
                "label": "VAT (USD)",
                "source_path": "calculate_final_price.output.results.vat_amount",
                "editable": false,
                "type": "number"
              },
              {
                "field": "grand_total",
                "label": "Grand Total (USD)",
                "source_path": "calculate_final_price.output.results.grand_total",
                "editable": true,
                "type": "number",
                "min": 0,
                "description": "Adjust the final price if needed before sending to customer."
              },
              {
                "field": "transit_days",
                "label": "Transit Days",
                "source_path": "calculate_final_price.output.results.transit_days",
                "editable": true,
                "type": "number",
                "min": 1,
                "description": "Adjust the transit time if needed."
              },
              {
                "field": "validity_date",
                "label": "Rate Validity",
                "source_path": "calculate_final_price.output.results.validity_date",
                "editable": false,
                "type": "string"
              }
            ]
          },
          "actions": {
            "source": "policy",
            "items": [
              {
                "id": "confirmed",
                "label": "Confirm & Generate Quotation",
                "type": "goto",
                "style": "primary",
                "confirm_required": false
              }
            ]
          },
          "require_note": false,
          "show_ai_recommendation": false
        }
      ],
      "timeout": {
        "duration_seconds": 7200,
        "action": "auto_approve",
        "warn_before_seconds": 600
      },
      "constraints": {
        "require_note": false,
        "note_label": "Notes (optional)",
        "note_max_length": 1000
      },
      "audit": {
        "capture_old_values": true,
        "expose_in_payload": true
      }
    }
  }'
```

### Step 2: Attach to rfq_agent node

```bash
# Replace <policy_id_type2> with the id returned from the create call above
# Replace <rfq_agent_node_id> with the workflow_node id for the rfq_agent node

curl -X POST "https://your-api-base/api/dashboard/policies/<policy_id_type2>/attach" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_node_id": <rfq_agent_node_id>,
    "priority": 2,
    "merge_strategy": "override"
  }'
```

Note: Both Type 1 and Type 2 policies attach to the same `rfq_agent` node.
The middleware selects the correct policy by evaluating `trigger_conditions` at runtime —
Type 1 fires on Turn 1 (goto=get_rate), Type 2 fires on Turn 2 (goto=generate_quotation).

---

## 4. HITL Type 3 — Email Review

**Attaches to:** `send_email` node  
**Fires:** Conditionally — only when `email_type` in `["quotation", "apology"]`  
**Steps:** 1 — tool_args showing the email `message` (HTML body) and `subject` as editable fields  
**Actions:** Send (approved) · Don't Send (skip — bypasses tool execution)

> **Note:** The `type` field on `send_email_tool.send_email` is an `InjectedToolArg` — it is
> read from graph state and is NOT shown in the HITL form. The trigger condition reads it from
> state to decide whether to fire. This requires the platform fix described in §6.

### Step 1: Create the policy

```bash
curl -X POST "https://your-api-base/api/dashboard/policies/" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RFQ — Email Review (Type 3)",
    "category": "hitl",
    "description": "Presents the email body and subject for review and editing before sending. Fires only for quotation and apology emails; clarification emails are sent automatically.",
    "config_json": {
      "id": "rfq_type3_email_review",
      "priority": 1,
      "title": "Review Email Before Sending",
      "description": "Review and edit the email content before it is sent to the customer.",
      "urgency": "high",
      "trigger_conditions": {
        "metric": "execution_variables.email_type",
        "operator": "in",
        "threshold": ["quotation", "apology"]
      },
      "show_ai_recommendation": false,
      "rejection_action": "fail",
      "steps": [
        {
          "name": "review_email",
          "order": 0,
          "title": "Review Email Before Sending",
          "description": "The email below is ready to send. You may edit the subject or body. Choose Send to send it or Don't Send to discard.",
          "interaction_type": ["tool_args"],
          "tool_args": {
            "ui_schema": {
              "message": {
                "description": "Email body (HTML). You may edit the content before sending.",
                "format": "html"
              },
              "subject": {
                "description": "Email subject line."
              }
            }
          },
          "actions": {
            "source": "policy",
            "items": [
              {
                "id": "approved",
                "label": "Send Email",
                "type": "goto",
                "style": "primary",
                "confirm_required": false
              },
              {
                "id": "skip",
                "label": "Don'\''t Send",
                "type": "skip",
                "style": "danger",
                "confirm_required": true,
                "confirm_message": "Are you sure you want to skip sending this email?"
              }
            ]
          },
          "require_note": false,
          "show_ai_recommendation": false,
          "timeout_minutes": 120
        }
      ],
      "timeout": {
        "duration_seconds": 7200,
        "action": "auto_approve",
        "warn_before_seconds": 600
      },
      "constraints": {
        "require_note": false,
        "note_label": "Notes (optional)",
        "note_max_length": 1000
      },
      "audit": {
        "capture_old_values": true,
        "expose_in_payload": false
      }
    }
  }'
```

### Step 2: Attach to send_email node

```bash
# Replace <policy_id_type3> with the id returned from the create call above
# Replace <send_email_node_id> with the workflow_node id for the send_email node

curl -X POST "https://your-api-base/api/dashboard/policies/<policy_id_type3>/attach" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_node_id": <send_email_node_id>,
    "priority": 1,
    "merge_strategy": "override"
  }'
```

---

## 5. Workflow Graph Changes

### Nodes to remove

```bash
# Identify and delete carrier_1 node
curl -X DELETE "https://your-api-base/api/dashboard/workflow-nodes/<carrier_1_node_id>" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>"

# Identify and delete carrier_2 node
curl -X DELETE "https://your-api-base/api/dashboard/workflow-nodes/<carrier_2_node_id>" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>"
```

### New edges to add

After removing `carrier_1`/`carrier_2`, the workflow graph edges need updating:

| From | To | Trigger |
|---|---|---|
| `calculate_final_price` | `rfq_agent` | (static — re-invokes supervisor) |
| `rfq_agent` | `generate_quotation` | `goto == "generate_quotation"` (Turn 2, carriers found) |
| `rfq_agent` | `send_email` | `goto == "send_email"` (Turn 1 clarification OR Turn 2 apology) |
| `generate_quotation` | `send_email` | (static) |

The `rfq_agent` → `get_rate` edge already exists. Verify the `get_tier` → `get_rate` edge
also exists (get_tier runs automatically before get_rate; rfq_agent is unaware of get_tier).

### rfq_agent node — conditional Turn 2 context injection (without breaking Turn 1)

Important: do **not** replace `config_json` with only an input mapping. Merge into the existing
`rfq_agent` config so current conditional `output_format_rules` remain intact.

Also note the formatter key is `input_format` (supported), not `input_data_format`.
With `input_format_rules` support, make Turn 2 injection conditional in middleware
instead of relying only on prompt-level guards.

Use:
- `input_format_rules` for Turn 2 (`calculate_final_price` exists)
- `input_format_default` for Turn 1 and all other invocations

```bash
curl -X PATCH "https://your-api-base/api/dashboard/workflow-nodes/<rfq_agent_node_id>" \
  -H "user-id: <user_id>" \
  -H "access-token: <access_token>" \
  -H "organisation-id: <organisation_id>" \
  -H "Content-Type: application/json" \
  -d '{
    "config_json": {
      "enable_routing": true,
      "update_input_data": true,
      "allow_intervention": true,
      "enable_input_formatting": true,
      "input_format_rules": [
        {
          "condition": "data.calculate_final_price != null",
          "input_format": {
            "data": {
              "path": "input_data.data",
              "default": []
            },
            "subject": {
              "path": "input_data.subject",
              "default": ""
            },
            "message": {
              "path": "input_data.message",
              "default": ""
            },
            "carrier_results": {
              "path": "data.calculate_final_price.results",
              "default": []
            },
            "is_rate_review_turn": true
          }
        }
      ],
      "input_format_default": {
        "data": {
          "path": "input_data.data",
          "default": []
        },
        "subject": {
          "path": "input_data.subject",
          "default": ""
        },
        "message": {
          "path": "input_data.message",
          "default": ""
        },
        "carrier_results": {
          "path": "data.calculate_final_price.results",
          "default": []
        },
        "is_rate_review_turn": false
      },
      "output_format_rules": [
        {
          "condition": "goto == 'generate_quotation'",
          "output_format": {
            "goto": "goto",
            "summary": "summary",
            "response": {
              "origin": "state.data.get_rate.results[0].origin",
              "carriers": "state.data.calculate_final_price.results",
              "width_cm": "state.data.get_rate.results[0].width_cm",
              "height_cm": "state.data.get_rate.results[0].height_cm",
              "length_cm": "state.data.get_rate.results[0].length_cm",
              "weight_kg": "state.data.get_rate.results[0].weight_kg",
              "destination": "state.data.get_rate.results[0].destination",
              "shipment_date": "state.data.get_rate.results[0].date",
              "number_of_boxes": "state.data.get_rate.results[0].number_of_boxes"
            },
            "next_steps": "next_steps",
            "confidence_score": "confidence_score"
          }
        }
      ],
      "intervention_question": "Should i proceed with the Email",
      "output_format_default": {
        "goto": "goto",
        "summary": "summary",
        "response": "response",
        "next_steps": "next_steps",
        "confidence_score": "confidence_score"
      },
      "enable_output_formatting": true
    }
  }'
```

Prompt contract for safety (still recommended):
- Turn 2 logic should only execute when `is_rate_review_turn == true`.
- If `is_rate_review_turn` is false, ignore `carrier_results` and follow normal Turn 1 extraction flow.

---

## 6. Platform Fix — Conditional Tool_args HITL

**File:** `app/core/middleware/common/hitl_middleware.py`

**Problem:** The tool_args HITL path (lines ~714–925, `_handle_tool_args_intercept`) fires
unconditionally. `_should_fire_hitl` is never called for tool nodes, so `trigger_conditions`
in the Type 3 policy are ignored.

**Required change (in `before_node`):**

```python
# After _find_tool_args_step() returns a match, before calling _handle_tool_args_intercept:

step_result = self._find_tool_args_step(hitl_policies)
if step_result:
    step_index, step, policy = step_result
    # NEW: evaluate trigger conditions against graph state
    should_fire = self._should_fire_hitl(policy, output={}, state=state)
    if not should_fire:
        return MiddlewareResult()   # let tool execute without interruption
    return await self._handle_tool_args_intercept(...)
```

**Condition evaluator update** (`app/core/hitl/condition_evaluator.py`):

`evaluate_trigger_tree` currently resolves metrics only from `output`. For tool nodes,
`output` is `{}` so state-based conditions always short-circuit to `False`.

Add a `state` parameter and fall back to state resolution when the metric is absent from output:

```python
def evaluate_trigger_tree(
    node: dict[str, Any],
    output: dict[str, Any],
    state: dict[str, Any] = {},          # NEW parameter
) -> bool:
    ...
    # In _get_at_path / leaf evaluation:
    value = _get_at_path(output, metric)
    if value is None and state:           # NEW: fallback to state
        value = _get_at_path(state, metric)
    ...
```

This change is backward-compatible: existing agent-node policies pass `output` as today and
the state fallback only activates when `output` doesn't contain the metric.

---

## 7. rfq_agent Prompt Changes

Changes are minimal — the forms are built entirely by the HITL policies.

### Remove from prompt

- `hitl_actions` field (all rules and table entries)
- `goto="carrier_1"`, `goto="carrier_2"`, `goto="carrier_N"` values and routing table rows
- STEP A3 / A4 (call `calculate_final_price` as a tool, set goto="carrier_1")
- STEP 4 / STEP 5 (same, Path B)
- "AVAILABLE TOOLS" section (calculate_final_price is no longer an agent tool)
- "ROUTING OVERRIDE" section (Allowed goto values annotation)
- Carrier-count confidence score rules (single vs. multiple carrier threshold logic)

### Update: goto values table

```
| goto value           | When to use                                                     |
|----------------------|-----------------------------------------------------------------|
| "get_rate"           | Turn 1: all 8 fields confirmed                                  |
| "send_email"         | Turn 1: clarification (missing fields)                          |
|                      | Turn 2: apology (rate_unavailable)                              |
| "generate_quotation" | Turn 2: carriers found — HITL Type 2 fires automatically        |
| "end"                | Customer acknowledged the quote; job complete                   |
```

### Add: Turn 2 recognition block

```
TURN 2 — RATE REVIEW
You will be re-invoked after rates have been calculated. The carrier pricing results
will be provided in your context as "carrier_results".

If carriers are available (carrier_results is non-empty):
  - Set goto="generate_quotation", confidence_score=1.0, response="" (empty string).
  - In your summary, list every carrier name and its grand total so the reviewer
    knows what options are available.

If no rates were found (carrier_results is empty or rate_unavailable):
  - Compose a professional apology email in HTML (using only <p> tags, no inline styles).
  - Set goto="send_email", confidence_score=1.0, response=<apology HTML string>.
  - The email will be shown to a reviewer before sending.
```

### Summary discipline (unchanged but reinforced)

The `summary` field is the only memory that persists across job resumes. The prompt's
existing CRITICAL SUMMARY section covers Turn 1 field collection. For Turn 2, the agent must
also include all carrier names and prices so that any future resume has full context.

---

## 8. Verification Checklist

| Test | Expected result |
|---|---|
| Turn 1, high confidence (all 8 fields clear) | HITL Type 1 auto-approved; proceeds to get_rate automatically |
| Turn 1, low confidence | HITL Type 1 fires; reviewer sees form pre-filled with extracted values |
| Edit field in Type 1 form → Confirm | Edited value written to state via source_path; get_rate uses corrected value |
| "Correct & Re-extract" in Type 1 | rfq_agent reruns; HITL Type 1 fires again with new extraction |
| 1 carrier returned | HITL Type 2 Step 1 shows 1 card |
| 4 carriers returned | HITL Type 2 Step 1 shows 4 cards; no graph changes needed |
| Select carrier in Step 1 | `calculate_final_price.output.results` becomes single carrier dict |
| Step 2 form pre-fill | Shows selected carrier's carrier, subtotal, VAT, grand_total, transit_days |
| Edit grand_total in Step 2 | generate_quotation receives edited value from state |
| Rate unavailable | rfq_agent Turn 2 → goto="send_email" (apology); HITL Type 2 does NOT fire |
| send_email with email_type="quotation" | HITL Type 3 fires; reviewer sees editable email body + subject |
| send_email with email_type="clarification" | HITL Type 3 does NOT fire; email sent directly |
| "Don't Send" in Type 3 | Tool execution skipped; job ends without sending email |
| Edit email body in Type 3 → Send | Edited HTML sent, not original |
| carrier_1 / carrier_2 nodes removed | Workflow graph has no carrier_N nodes; no routing errors |
