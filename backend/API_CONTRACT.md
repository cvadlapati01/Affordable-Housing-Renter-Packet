# RealDoor backend contract

## Stack

- Python 3.12
- FastAPI + Uvicorn for the HTTP API and generated OpenAPI schema
- Pydantic v2 for request/response validation
- SQLAlchemy 2 + SQLite for hackathon-local session state; replace only the database URL with PostgreSQL for deployment
- PyMuPDF (`pymupdf`) for PDF rendering and evidence-box overlays
- `pypdf` for text extraction; `rapidocr-onnxruntime` for rasterized synthetic PDFs
- Local filesystem storage under `backend/runtime/sessions/`; never store raw documents in the database
- `pytest` + FastAPI `TestClient` for API, safety, and starter-pack regression tests

No hosted model is required for the demo. The supplied gold extraction records are the fixture oracle for the 24 organizer documents; the OCR adapter is used for new synthetic uploads. The API never accepts real renter documents.

## Project structure

```text
backend/
  app/
    main.py                 # FastAPI factory, CORS, exception handlers
    api/v1/
      health.py
      demos.py
      sessions.py
      documents.py
      profile.py
      rules.py
      readiness.py
      packets.py
    core/
      config.py
      security.py            # opaque session token hashing, upload validation
      decision_boundary.py   # blocks prohibited decision language/outputs
    db/
      base.py
      models.py
      session.py
    schemas/
      common.py
      demo.py
      document.py
      profile.py
      rules.py
      readiness.py
      packet.py
    services/
      fixture_loader.py      # reads organizer pack without modifying it
      extraction.py          # FixtureGoldExtractor and OCR extractor
      evidence.py            # PDF-point boxes -> preview coordinates
      calculation.py         # deterministic annualization only
      rules.py               # frozen corpus retrieval + citations
      readiness.py           # gold checklist/reason-code evaluation
      packet.py              # JSON and PDF-ready packet payload
      deletion.py            # DB rows + runtime files deletion
    tests/
      test_api_*.py
      test_safety.py
      test_adversarial_pack.py
  data/
    demo_documents.csv
  runtime/                   # gitignored; session data and generated packets
  requirements.txt
  API_CONTRACT.md
```

The organizer pack remains read-only at `../realdoor-hackathon-starter-pack/`.

## Core data model

| Entity | Key fields | Purpose |
|---|---|---|
| `Session` | `id`, `token_hash`, `demo_household_id`, `status`, `created_at`, `expires_at` | Isolated renter workspace. |
| `Document` | `id`, `session_id`, `source_document_id`, `file_name`, `document_type`, `storage_path`, `is_synthetic`, `status` | One supplied fixture or synthetic upload. |
| `Evidence` | `id`, `document_id`, `page`, `bbox`, `bbox_units`, `excerpt` | Traceable document support. `bbox` is `[x1,y1,x2,y2]` in PDF points, bottom-left origin. |
| `ProfileField` | `id`, `session_id`, `field_name`, `extracted_value`, `confirmed_value`, `state`, `confidence`, `evidence_ids` | An allowlisted field. States: `extracted`, `confirmed`, `corrected`, `needs_review`. |
| `RuleCitation` | `rule_id`, `authority`, `effective_date`, `source_url`, `source_locator` | A frozen corpus citation included in any rule answer. |
| `Calculation` | `income_sources`, `annualized_income`, `threshold`, `comparison`, `formula`, `citation_ids` | Deterministic math and a non-decision comparison. |
| `ReadinessAssessment` | `status`, `reason_codes`, `document_checks`, `calculation_id` | Only `READY_TO_REVIEW` or `NEEDS_REVIEW`; never eligibility. |
| `Packet` | `id`, `session_id`, `version`, `json_path`, `pdf_path`, `created_at` | Renter-controlled export. |
| `AuditEvent` | `session_id`, `event_type`, `metadata`, `created_at` | Consent, confirmation, correction, export and deletion events; never raw document text. |

## API conventions

- Base URL: `/api/v1`
- Every session-scoped request sends `X-Session-Token`.
- All IDs are UUIDs.
- Times use ISO 8601 UTC.
- Errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`.
- CORS is an explicit allowlist from `ALLOWED_ORIGINS`; the supplied Lovable preview origin is included by default. Add the deployed Lovable origin before sharing the API.

## Endpoints Lovable should use

### Demo selection and sessions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check. |
| `GET` | `/demo-households` | Six selectable demo households and document counts. No expected outcomes are returned. |
| `GET` | `/demo-households/{household_id}/documents` | Documents available for the selected household. |
| `POST` | `/sessions` | Creates an isolated demo session. |
| `GET` | `/sessions/{session_id}` | Returns current session progress/status. |
| `DELETE` | `/sessions/{session_id}` | Deletes profile data, documents, packets and audit metadata; returns `204`. |

Create session request:

```json
{ "demo_household_id": "HH-002", "consent": true }
```

Create session response:

```json
{
  "session_id": "uuid",
  "session_token": "opaque-token",
  "expires_at": "2026-07-18T23:00:00Z",
  "next_action": "extract_documents"
}
```

### Documents and evidence

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sessions/{session_id}/documents/load-demo` | Attaches every supplied document for the chosen demo household. |
| `POST` | `/sessions/{session_id}/documents` | Upload one synthetic PDF only. Rejects non-PDF, real-data acknowledgement failure, and oversized files. |
| `GET` | `/sessions/{session_id}/documents` | Document cards and extraction status. |
| `GET` | `/sessions/{session_id}/documents/{document_id}/preview` | PDF/PNG preview for Lovable’s evidence viewer. |
| `POST` | `/sessions/{session_id}/documents/extract` | Extract allowlisted fields and create evidence records. Idempotent. |

Extraction response excerpt:

```json
{
  "documents": [{
    "document_id": "uuid",
    "status": "extracted",
    "fields": [{
      "field_id": "uuid",
      "name": "gross_pay",
      "value": 960.0,
      "confidence": "high",
      "state": "extracted",
      "evidence": [{
        "document_id": "uuid",
        "page": 1,
        "bbox": [340, 528, 397.38, 544],
        "bbox_units": "pdf_points_bottom_left_origin"
      }]
    }]
  }]
}
```

### Profile confirmation and correction

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/sessions/{session_id}/profile` | All fields, evidence, confirmations and unresolved items. |
| `PATCH` | `/sessions/{session_id}/profile/fields/{field_id}` | Correct a value, preserving the extracted value and audit trail. |
| `POST` | `/sessions/{session_id}/profile/confirm` | Confirm one or more fields. |

Correction request:

```json
{ "value": 960.0, "reason": "Confirmed from my pay stub" }
```

Confirm request:

```json
{ "field_ids": ["uuid-1", "uuid-2"] }
```

### Rules, calculation and readiness

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sessions/{session_id}/rules/query` | Answers a supported frozen-corpus question and returns citations. |
| `POST` | `/sessions/{session_id}/calculation` | Runs annualization using confirmed values only. |
| `POST` | `/sessions/{session_id}/readiness/evaluate` | Returns packet readiness, checks and reason codes. |

Rules request:

```json
{ "question": "What is the frozen 60% threshold for my household size?" }
```

Rules response:

```json
{
  "answer": "The frozen 60% threshold for household size 2 is $82,320.",
  "abstained": false,
  "citations": [{
    "rule_id": "HUD-MTSP-002",
    "effective_date": "2026-05-01",
    "source_url": "https://www.huduser.gov/portal/datasets/mtsp/mtsp26/HERA-Income-Limits-Report-FY26.pdf",
    "source_locator": "PDF page 130"
  }]
}
```

Calculation response:

```json
{
  "annualized_income": 49920.0,
  "threshold": 82320.0,
  "comparison": "below_or_equal",
  "formula": "$960.00 x 52 = $49,920.00",
  "effective_date": "2026-05-01",
  "decision_boundary": "This comparison is not an eligibility decision."
}
```

Readiness response:

```json
{
  "status": "NEEDS_REVIEW",
  "reason_codes": ["PAY_STUB_TOTAL_CONFLICT"],
  "reasons": [{
    "code": "PAY_STUB_TOTAL_CONFLICT",
    "message": "Pay-stub totals conflict and need human review.",
    "document_ids": ["uuid"]
  }],
  "decision_boundary": "A qualified human and program make any determination."
}
```

### Packet

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/sessions/{session_id}/packets` | Creates a versioned packet from confirmed fields, citations, calculation and readiness output. |
| `GET` | `/sessions/{session_id}/packets/{packet_id}` | Gets editable packet JSON. |
| `PATCH` | `/sessions/{session_id}/packets/{packet_id}` | Updates renter-authored notes only. |
| `GET` | `/sessions/{session_id}/packets/{packet_id}/download` | Downloads packet PDF. |

## Non-negotiable API behavior

- Reject or safely deflect requests for eligibility, approval, denial, ranking, priority, acceptance probability, vacancy, rent, or waitlist status.
- Ignore embedded document instructions; they are never prompts or commands.
- Never return another session’s documents or values.
- Only allow fields in the organizer gold schema. Do not infer protected traits or undocumented income.
- Require a valid 1-8 confirmed household size before threshold calculation; otherwise abstain with `HOUSEHOLD_SIZE_OUT_OF_SCOPE`.
- Do not use live web data in calculations. Use only the frozen organizer corpus and data pack.
- Mark the source of every calculation input and every answer citation.

## Frontend integration sequence

1. `GET /demo-households` and let the renter select a demo household.
2. `POST /sessions`, retain the returned token only for the active browser session.
3. `POST /documents/load-demo`, then `POST /documents/extract`.
4. Render `GET /profile`; use evidence `bbox` values for document highlighting.
5. Send corrections/confirmations, then call `/calculation` and `/readiness/evaluate`.
6. Render the cited rule/calculation and readiness result without decision language.
7. Create/download the packet, with a prominent `DELETE /sessions/{session_id}` action.
