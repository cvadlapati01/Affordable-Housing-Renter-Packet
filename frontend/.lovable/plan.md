## RealDoor Renter Frontend

A calm, accessible, application-readiness flow with strict decision-boundary language. Never uses: eligible, ineligible, approved, denied, ranked, likely.

### Design direction

- Calm, editorial, high-contrast neutral palette (warm off-white background, deep ink foreground, single muted teal accent, amber for "needs review", no green "success" tones that imply approval).
- Typography: serif display (e.g. Fraunces) + humanist sans (Inter Tight) for body — avoids generic AI look.
- Generous whitespace, single-column reading width, sticky step indicator across screens.
- All shadcn primitives themed via `src/styles.css` tokens (no hardcoded colors). Accessible focus rings, 44px tap targets, semantic landmarks, `aria-live` for status changes.

### Routes (TanStack Start, file-based)

```
src/routes/
  index.tsx                    → Welcome + consent
  select-household.tsx         → Demo household picker (HH-001..HH-006)
  session.$sessionId/
    route.tsx                  → Session layout (loads session, sidebar stepper, <Outlet/>)
    documents.tsx              → Document list + processing/extracted states
    profile.tsx                → Extracted fields, evidence links, Edit/Confirm
    rules.tsx                  → Formula, threshold, effective date, citation, disclaimer
    readiness.tsx              → READY_TO_REVIEW / NEEDS_REVIEW + reason codes
    packet.tsx                 → Packet preview, Download, Delete session
```

Session `id` + `token` stored only in `sessionStorage` under key `realdoor.session`. Session route reads from sessionStorage; missing/mismatch redirects to `/`.

### API client

`src/lib/api/client.ts`
- Reads `import.meta.env.VITE_API_BASE_URL`. When unset OR when a `?mock=1` flag / `VITE_USE_MOCK=true` is present, routes through the mock adapter.
- `apiFetch(path, { method, body, sessionToken })` attaches `X-Session-Token`, JSON serialization, typed error `{ error: { code, message, details } }`.
- Per-endpoint typed functions in `src/lib/api/endpoints.ts` matching the contract:
  - `getDemoHouseholds()`
  - `createSession({ demo_household_id, consent })`
  - `loadDemoDocuments(sessionId)`
  - `extractDocuments(sessionId)`
  - `getProfile(sessionId)`
  - `patchProfileField(sessionId, fieldId, { value, reason })`
  - `confirmProfileFields(sessionId, { field_ids })`
  - `runCalculation(sessionId)`
  - `evaluateReadiness(sessionId)`
  - `createPacket(sessionId)`
  - `deleteSession(sessionId)`
- Zod schemas for responses so mock and real backend share types.

### Mock data

`src/lib/api/mock/` — deterministic fixtures for HH-001..HH-006 (household size, one or two income earners, 2–4 documents each, one household intentionally producing `NEEDS_REVIEW` with reason `PAY_STUB_TOTAL_CONFLICT`, others `READY_TO_REVIEW`). Mock adapter simulates:
- extraction latency (~1.2s) with per-document `processing → extracted` transitions
- profile fields with `extracted` / `needs_review` states and evidence excerpts + document/page/bbox
- calculation with formula string and citation (HUD MTSP FY26, effective 2026-05-01)
- readiness with reason codes
- packet JSON preview and a client-generated PDF-like blob (using a simple printable HTML → `window.print` fallback for "Download") until real backend returns a PDF

### Screen behavior

1. **Welcome / consent** (`/`) — product description, decision-boundary disclaimer, required consent checkbox, "Continue" → `/select-household`.
2. **Household selector** — card grid of 6 households (size, city, document count only; no outcomes hinted). Selecting one calls `POST /sessions` with `consent: true`, stores token, calls `documents/load-demo`, then navigates to session documents.
3. **Documents** — list with per-document status chips (`loading`, `processing`, `extracted`, `needs_review`). "Run extraction" button triggers `documents/extract`. Each row expands to show extracted fields + evidence excerpts.
4. **Profile review** — grouped fields (Identity, Household, Income). Each row shows extracted value, confidence, "View source" link (opens a side panel with document name, page, excerpt, bbox coords), inline Edit (PATCH), and per-field Confirm. Bulk "Confirm all remaining" action. Progresses when all required fields confirmed.
5. **Rules & calculation** — triggers `POST /calculation`. Shows: household size, income sources list, formula string (e.g. `$960.00 × 52 = $49,920.00`), threshold, effective date, citation card (authority, rule_id, source link, locator). Persistent disclaimer: "This comparison is not an eligibility decision." No comparison verdict language beyond the neutral `comparison` value rendered as "at or below threshold" / "above threshold" framed as informational.
6. **Readiness** — triggers `POST /readiness/evaluate`. Large status badge `READY_TO_REVIEW` (neutral ink) or `NEEDS_REVIEW` (amber). Reason code list with human-readable messages and links back to source documents. Disclaimer: "A qualified human and program make any determination."
7. **Packet preview** — triggers `POST /packets`, renders packet JSON as a structured, printable summary (identity, household, income, calculation, citations, readiness, renter notes textarea). Actions: **Download packet** (calls download endpoint / mock blob) and **Delete session** (confirm dialog → `DELETE /sessions/{id}` → clears sessionStorage → returns to `/`).

### Guardrails

- Central `src/lib/language.ts` re-exports approved status labels; a unit-style constant map ensures banned words never leak. Copy audited at write time.
- All decision-boundary strings sourced from one module for consistency.

### Head metadata

Per-route `head()` with distinct titles/descriptions. `__root.tsx` updated to a real RealDoor title/description (replacing "Lovable App").

### Out of scope for this pass

- Real PDF rendering with bbox overlays (mock shows excerpt text + coords; wire real preview endpoint when backend URL lands).
- Uploading synthetic PDFs (`POST /documents`) — demo flow only.
- Rules Q&A free-text endpoint (`/rules/query`) — not in required flow.

After you approve, I'll implement the routes, client, mocks, and shared UI in one pass. When you provide `VITE_API_BASE_URL`, only the env var flips the client from mock to live — no code changes needed.
