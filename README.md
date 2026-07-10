# GrowEasy AI CSV Importer

Turn any messy lead export — Facebook Lead Ads, Google Ads, real-estate CRM dumps, agency sheets, hand-made spreadsheets — into clean, validated GrowEasy CRM records. Columns don't have to match a fixed schema: an LLM handles the semantic mapping, and a deterministic layer handles everything mechanical and safety-critical.

Upload → preview locally → confirm → AI-assisted import → review, then export CRM CSV / JSON / skipped rows.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works-two-layer-extraction)
- [Screenshots](#screenshots)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API](#api)
- [Verifying it works](#verifying-it-works)
- [Deployment](#deployment)
- [Engineering decisions](#engineering-decisions)
- [Limitations & next steps](#limitations--next-steps)
- [Project structure](#project-structure)

---

## Features

- **Arbitrary CSV in, GrowEasy CRM out.** No fixed headers; the AI maps meaning, not column positions.
- **Local preview before any upload.** The browser parses and previews the file (PapaParse); nothing is sent until you click **Confirm & Process with AI**.
- **Resilient batching.** Bounded-concurrency AI batches with retries and response repair. A single failed batch never aborts the whole import — its rows are skipped with a reason.
- **Deterministic guardrails.** Dates, emails, phones, country codes, status/data-source enums, and note assembly are all handled in code, not left to the model.
- **Honest skip reasons.** Every skipped row carries a specific, non-empty reason and its original data.
- **Provider-agnostic.** OpenAI and Gemini adapters ship today (Claude is a drop-in next); Gemini is the default for the public demo.
- **Polished UX.** Drag/drop, sticky-header scrollable tables, summary metric cards, results/skipped/warnings tabs, dark mode, toasts, and CSV/JSON exports.

## Tech stack

| Layer    | Choices                                                        |
|----------|---------------------------------------------------------------|
| Frontend | Next.js, TypeScript, Tailwind CSS, PapaParse                  |
| Backend  | Node.js, Express, TypeScript, Multer (memory), p-limit        |
| Shared   | TypeScript types, constants, Zod schemas, normalization utils |
| AI       | OpenAI + Gemini adapters (provider abstraction)               |
| Tooling  | pnpm workspaces, Vitest, Docker Compose                       |

Stateless by design — no database, no auth.

---

## How it works (two-layer extraction)

The importer deliberately separates **semantic** work from **mechanical** work. This is the core design decision and the reason the output is reliable.

**Layer 2 — AI (semantic only).** The model receives candidate rows and identifies *meaning*: name, company, city/state/country, lead owner, raw status text, remarks, raw source, possession time, description — plus hints for which contact values belong to the **owner** so they can be excluded from the lead. The AI never builds final records, never splits or reformats contacts, never formats dates, never assembles notes, and never decides skips.

**Layer 1 — deterministic (mechanical + safety).** The backend owns everything that must be correct every time:

1. **Pre-scan gate.** Every row is scanned for any contact signal. Rows with neither an email nor a valid mobile are skipped *before* the AI runs, with reason `Missing email and mobile number`.
2. **AI pass** on the surviving rows, in batches.
3. **Owner-aware re-extraction.** Using the AI's owner hints, contacts are re-extracted while excluding the owner's email/phone and column. If nothing lead-side remains, the row is skipped with reason `Contact info belongs to lead owner only`.
4. **Normalization.** Dates, phones, country codes, status, and data-source are normalized; the final `crm_note` is assembled exactly once.

This ordering prevents two subtle bugs: **owner-email theft** (an agent's address being imported as the lead's email) and **premature contactability decisions** (skipping before we know which contact belongs to whom).

**One date pipeline.** `normalizeDate` always receives the *original* CSV cell text — `created_at_raw` from the AI is only used to pick which cell is the date, never to reformat it.

**Documented assumptions.** Ambiguous slash dates (e.g. `06/07/2026`) default to **DD/MM/YYYY** for the Indian CRM context. Bare valid ten-digit Indian mobiles are assigned **`+91`**; an explicit, valid country-code column always wins over the default.

---

## Screenshots

> Add images to `docs/screenshots/` and reference them here.

| Upload | Preview | Results |
|--------|---------|---------|
| _`docs/screenshots/upload.png`_ | _`docs/screenshots/preview.png`_ | _`docs/screenshots/results.png`_ |

---

## Getting started

```bash
cp .env.example .env
# set GEMINI_API_KEY  (or set AI_PROVIDER=openai and OPENAI_API_KEY)

corepack pnpm install
corepack pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000

Verify the workspace:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

---

## Environment variables

Copy `.env.example` and fill in a provider key. Keep this table and `.env.example` in sync.

| Variable                  | Purpose                                              | Example                    |
|---------------------------|------------------------------------------------------|----------------------------|
| `PORT`                    | API port                                             | `4000`                     |
| `FRONTEND_URL`            | Allowed CORS origin (web app)                        | `http://localhost:3000`    |
| `MAX_UPLOAD_MB`           | Upload size limit                                    | `5`                        |
| `AI_PROVIDER`             | `gemini` or `openai`                                 | `gemini`                   |
| `GEMINI_API_KEY`          | Gemini key (default provider for the demo)           | _your key_                 |
| `GEMINI_MODEL`            | Gemini model (use one your key supports)             | `gemini-1.5-flash`         |
| `OPENAI_API_KEY`          | OpenAI key (if `AI_PROVIDER=openai`)                 | _your key_                 |
| `OPENAI_MODEL`            | OpenAI model                                         | `gpt-4o-mini`              |
| `AI_BATCH_SIZE`           | Rows per AI batch                                    | `12`                       |
| `AI_BATCH_CONCURRENCY`    | Parallel batches (bounded)                           | `2`                        |
| `AI_MAX_RETRIES`          | Retries per failed batch                             | `2`                        |
| `RATE_LIMIT_PER_IP_PER_MIN` | Per-IP request cap for the public demo             | `5`                        |

> **Public demo note:** the hosted app defaults to the **Gemini free tier** with a per-IP rate limit so a reviewer's testing can't exhaust a paid key.

---

## API

### `POST /api/import`

Multipart upload; field name `file` (`.csv`, 5 MB default).

**Response**

```json
{
  "summary": {
    "totalRows": 26,
    "imported": 24,
    "skipped": 2,
    "batchesProcessed": 3
  },
  "records": [ /* exactly 15 GrowEasy CRM fields each */ ],
  "skippedRecords": [
    { "rowNumber": 25, "reason": "Missing email and mobile number", "original": { } }
  ],
  "warnings": []
}
```

Every record contains exactly the 15 CRM fields: `created_at, name, email, country_code, mobile_without_country_code, company, city, state, country, lead_owner, crm_status, crm_note, data_source, possession_time, description`.

`summary.totalRows` excludes the header and is asserted to equal `imported + skipped`. `crm_status` is one of `GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE`; `data_source` is one of the five allowed projects or `""`.

### `GET /health`

Returns service status without exposing secrets.

---

## Verifying it works

**End-to-end + batching.** Run `corepack pnpm dev`, choose `samples/batch-verification.csv`, and click **Confirm & Process with AI**. With `AI_BATCH_SIZE=12`, the fixture produces **3 AI batches** and two skipped rows demonstrating *both* skip paths:

- a truly contactless row (no email, no mobile, no owner email) → `Missing email and mobile number` (skipped pre-AI)
- a row whose only contact is the owner's → `Contact info belongs to lead owner only` (skipped post-AI)

The result screen should show `totalRows: 26`, `imported + skipped == 26`, and `batchesProcessed: 3`. Set `AI_BATCH_SIZE=5`, restart the API, and re-run to confirm the batch count scales.

**Date guarantee.** Every `created_at` must be `new Date()`-parseable:

```bash
curl -s -F "file=@samples/real-estate-leads.csv" http://localhost:4000/api/import \
| jq -r '.records[].created_at' \
| while read d; do node -e "process.exit(isNaN(new Date('$d'))?1:0)" || echo "BAD: $d"; done
```

**Unit tests.** `corepack pnpm test` covers date normalization (incl. ambiguous DD/MM), email extraction with owner exclusion, phone extraction (bare → `+91`, pincodes/years/order-ids rejected), status and data-source mapping, contactless + owner-only skips, row reconciliation (duplicates, missing rows, order preserved after concurrency), Zod schema validation, `crm_note` de-duplication, and the count invariants.

**Failure handling.** Temporarily set an invalid `GEMINI_MODEL`, import the batch fixture, and confirm contactable rows return `AI batch failed after retries` rather than a 500; restore the model afterward.

---

## Deployment

- **API → Render** (using `render.yaml`). A long-running, multi-batch import is a poor fit for short serverless timeouts, so the API runs as a standard web service.
- **Web → Vercel.** Set `NEXT_PUBLIC_API_URL` to the Render API URL, and set the API's `FRONTEND_URL` to the Vercel origin so CORS is scoped correctly.
- **Self-hosted alternative:** `docker-compose.yml` builds and runs both apps together.

Default the deployed API to the Gemini free tier and keep `RATE_LIMIT_PER_IP_PER_MIN` set.

---

## Engineering decisions

- **Two layers, not one.** Letting the LLM do mechanical work (splitting contacts, formatting dates, deciding skips) produced duplicated notes and mis-assigned emails in early iterations. Moving all of that into deterministic code made the output stable and testable.
- **Owner-aware contact extraction, in a specific order.** Deciding contactability before knowing which email is the owner's caused two classes of bug; the pre-scan-gate → AI → owner-exclusion → re-check ordering fixes both.
- **The AI never formats dates.** Models occasionally "helpfully" reformat or truncate dates; the deterministic pipeline takes the raw cell so `new Date(created_at)` is always valid.
- **Documented, defensible defaults** for ambiguous dates (DD/MM) and bare mobiles (`+91`), rather than silent guesses.
- **Skips are always explained.** Every skipped row has a specific reason and its original payload, so imports are auditable.

## Limitations & next steps

- AI mapping requires a configured provider key; without one, imports fail with a clear message rather than degrading silently.
- The import endpoint returns a single final response; there is no streaming progress yet.
- Next: SSE/incremental progress, a Claude adapter, queueing for very large files, optional audit storage, and committed screenshots.

## Project structure

```
groweasy-ai-csv-importer/
├─ apps/
│  ├─ web/        # Next.js app: upload, preview, processing, results
│  └─ api/        # Express API: parsing, AI batching, normalization
├─ packages/
│  └─ shared/     # Zod schemas, types, constants, normalizers
├─ samples/       # messy CSV fixtures
├─ docker-compose.yml
├─ render.yaml
└─ .env.example
```
