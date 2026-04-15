# HITL Forms — Resolution Record

This document was originally written as a pre-implementation gap analysis for
integrating the HITL forms capability with the three RFQ interventions. All five
gaps have since been resolved by the implementation. The sections below record
what was anticipated, what was actually built, and how the two differ.

Reference implementation:
- `app/models/hitl.py` — `HITLInterruptPayload`, `HITLActionRequest`
- `app/core/hitl/interrupt_builder.py` — `build_interrupt_payload`, `build_form_data`, `build_candidate_data`
- `app/core/hitl/resume_handler.py` — `handle_resume`, `_apply_form_writebacks`, `_apply_candidate_writebacks`
- `app/core/middleware/common/hitl_middleware.py` — `_execute_multi_step`
- `app/api/dashboard/hitl/action.py` — live dashboard HITL action endpoint
- `sdd/hitl/hitl_form_use_cases.md` — authoritative spec

---

## Gap 1 — `form_data` missing from HITL action POST

**Anticipated:** A single opaque `form_data` dict added to the POST body.

**Implemented (better):** The new `HITLActionRequest` model (`app/models/hitl.py:113`)
splits the response into typed fields rather than one generic blob:

```python
class HITLActionRequest(BaseModel):
    action: str                                       # routing decision
    note: Optional[str] = None                        # reviewer note (replaces note_reference)
    edited_values: Optional[Dict[str, Any]] = None    # form edits: field_key → new_value
    selected_candidate_id: Optional[str] = None       # identity of chosen candidate (UC-9)
    candidate_edits: Optional[Dict[str, Any]] = None  # per-field edits on selected candidate
    instruction: Optional[str] = None                 # free-text instruction (UC-6/UC-12)
    data: Optional[Dict[str, Any]] = None             # catch-all; free_text_input stored here
```

The full response is persisted via `hitl.hitl_response` (JSON column). The old
`HitlActionRequest` (`app/models/hitl.py:38`) still exists but is used only by the
deprecated internal endpoint (`app/api/internal/hitl_action.py`). The live dashboard
endpoint (`app/api/dashboard/hitl/action.py`) uses `HITLActionRequest` exclusively.

**Dashboard impact:** Use the new field names in all HITL action POST calls:
- `note` instead of `note_reference`
- `edited_values` (not `form_data`) for Type 1 field corrections
- `selected_candidate_id` (not `form_data.selected_carrier`) for Type 2 candidate selection

---

## Gap 2 — Agent not receiving corrected form values

**Anticipated:** Platform injects a system message with corrected values before
agent resume.

**Implemented (cleaner mechanism):** Direct graph state writeback via `source_path`.

`_apply_form_writebacks` (`resume_handler.py:126`) looks up each field in the step's
`form.value_mappings`, finds its `source_path`, and calls `set_nested(state, source_path, new_value)`.
When the node re-runs (via `correct_and_rerun` or normal resume), it reads the
already-corrected values directly from graph state — no prompt injection required.

For the retrigger case, `_inject_retrigger_instruction` (`resume_handler.py:291`) writes
the human's instruction to `execution_variables.hitl_instruction`, which the agent reads
on its next execution. Architecturally cleaner than message injection and decoupled from
the agent's prompt format.

**Dashboard impact:** None. The dashboard submits `edited_values` and the platform
handles propagation transparently.

---

## Gap 3 — Positional carrier IDs vs. identity-based candidate selection

**Anticipated:** `selected_candidate_id` added as a semantic identifier alongside
the positional `action: "carrier_1"`.

**Implemented (identity-based, positional removed):** `selected_candidate_id` in
`HITLActionRequest` is the value of the candidate's `id_field` (e.g., `"IndiGo Cargo"`
if `id_field = "carrier"`). `_apply_candidate_writebacks` (`resume_handler.py:174`)
locates the selected candidate by matching `selected_candidate_id` against `id_field`
in the candidates list, applies any `candidate_edits`, and replaces the entire list at
`candidates.source_path` in graph state with the single selected object. Positional
index mapping is gone (UC-9).

The `action` field still carries the routing decision (e.g., `carrier_1`) because that
comes from the step's action config. But the selected candidate is communicated by
identity, not position.

**Dashboard impact:**
- Set `selected_candidate_id` to the value of the `id_field` for the chosen candidate
  object. Read `interrupt_message.data.candidate_selection.id_field` to know which
  field to use as the identity key.
- Do not compute a positional `carrier_N` action from the selected array index — the
  action routing value comes from `interrupt_message.actions` as configured in the step.

---

## Gap 4 — No multi-step form support within a single HITL pause

**Anticipated:** A multi-step form engine with inline partial agent re-runs
between steps.

**Implemented:** `_execute_multi_step` (`hitl_middleware.py:333`) implements the full
sequential interrupt→resume loop across as many steps as a policy defines. Each step
is one interrupt; writebacks from each step are applied before the next step runs.

The field-correction → rate-refetch scenario is achieved via the `correct_and_rerun`
action type (UC-12): after the reviewer corrects fields and submits
`action: "correct_and_rerun"`, the middleware re-runs the agent node (which re-fetches
rates with the corrected state) and the next HITL pause presents updated carriers.
This achieves the same UX through sequential pauses rather than inline re-runs —
exactly the interim approach the gap recommended, and it works without a specialised
partial-rerun engine.

**Dashboard impact:** The dashboard does not manage multi-step state. Each
`interrupt_message` carries `step_index` and `total_steps` for progress display.
The middleware handles step advancement transparently.

---

## Gap 5 — HITL form schema source

**Anticipated:** Option A (recommended) — node-specific form templates pre-configured
on the platform.

**Implemented:** Option A, exactly as recommended. The HITL policy config for each
workflow node contains `steps[].form.value_mappings` — this is the per-node form
schema template. `build_form_data` (`interrupt_builder.py:47`) resolves `source_path`
from graph state into `current_values` and returns:

```python
{
    "current_values": { field_key: resolved_value, ... },
    "schema": [ FormFieldMapping, ... ],
    "resolved_options": { field_key: [option, ...], ... },
}
```

The dashboard reads `interrupt_message.data.form.schema` to render the form and
`interrupt_message.data.form.current_values` to pre-fill it. No agent `form_schema`
output required — the agent prompt and output schema are unchanged.

`build_candidate_data` (`interrupt_builder.py:103`) extracts the candidates list from
`candidates.source_path` in graph state and returns `{ options, display_fields, id_field, source_path }`.
The dashboard reads `interrupt_message.data.candidate_selection` directly.

**Dashboard impact:** Use `interrupt_message.data.*` paths for all form rendering.
See `dashboard-scope-v2.md` Section 9 for the full field reference.

---

## Legacy Note — Old Model and Endpoint

`HitlActionRequest` (old model, `app/models/hitl.py:38`) and the internal endpoint
`app/api/internal/hitl_action.py` are marked DEPRECATED. Both can be removed when
convenient. The dashboard must only use `HITLActionRequest` via the live endpoint
`app/api/dashboard/hitl/action.py`.

---

## Summary

| Gap | Status | Mechanism |
|---|---|---|
| 1 — form_data in POST | Resolved (better design) | Typed fields: `edited_values`, `selected_candidate_id`, `candidate_edits`, `instruction` |
| 2 — Agent context injection | Resolved (cleaner) | Direct graph state writeback via `source_path`; `hitl_instruction` for retrigger |
| 3 — Positional carrier IDs | Resolved (identity-based) | `selected_candidate_id` + `_apply_candidate_writebacks` by `id_field` |
| 4 — Multi-step form support | Resolved | `_execute_multi_step` with `correct_and_rerun` for field-edit → re-rate flow |
| 5 — Form schema source | Resolved (Option A as recommended) | Node-specific `steps[].form.value_mappings` in policy config; resolved by `build_form_data` |

No platform backend changes are required to support the RFQ HITL forms. All
capabilities are live. Dashboard work can proceed against the current implementation.
