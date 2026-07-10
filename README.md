# GrowEasy AI CSV Importer

An AI-assisted, stateless CSV importer that turns arbitrary lead exports into validated GrowEasy CRM records. The web app previews CSV data locally before sending it to the API for semantic mapping.

## Highlights

- Next.js + Tailwind web app with drag/drop, local preview, progress feedback, exports, results tabs, and responsive sticky tables.
- Express API with CSV upload limits, IP rate limiting, bounded AI batch concurrency, retries, response repair, and per-row skip reasons.
- OpenAI and Gemini provider adapters; Gemini is the default for the public demo.
- Shared Zod contracts and Vitest coverage for CRM-safe normalization.

## Architecture

The importer intentionally separates semantic work from mechanical work. The AI receives only contactable candidate rows and identifies meaning (name, owner, location, notes, source, status, and which owner contact must be excluded). It never creates final CRM records, splits contacts, formats dates, builds notes, or skips a row.

The deterministic layer pre-scans every row for any contact signal. Rows with neither an email nor a valid mobile are skipped as `Missing email and mobile number` before AI. After AI returns owner hints, it re-extracts contacts while excluding the owner values/column. If no lead contact remains it skips with `Contact info belongs to lead owner only`. This ordering prevents owner-email theft and premature contactability decisions.

There is one date pipeline: the backend takes an unmodified original CSV cell, using `created_at_raw` only to select among cells, then normalizes it. Ambiguous slash dates default to DD/MM/YYYY for the Indian CRM context. Bare valid ten-digit Indian mobiles get `+91`; an explicit valid country-code column always wins.

## Run locally

```bash
cp .env.example .env
# set GEMINI_API_KEY (or set AI_PROVIDER=openai and OPENAI_API_KEY)
corepack pnpm install
corepack pnpm dev
```

The web app runs on `http://localhost:3000`; API on `http://localhost:4000`. Use `corepack pnpm test`, `corepack pnpm typecheck`, and `corepack pnpm build` to verify the workspace.

## API

`POST /api/import` accepts a multipart `file` CSV field (5MB default) and returns `{ summary, records, skippedRecords, warnings }`. Records always contain exactly the 15 GrowEasy CRM fields. `summary.totalRows` excludes the header and is checked against imported plus skipped rows.

## Verifying batches and edge cases

Start both apps with `corepack pnpm dev`, choose `samples/batch-verification.csv` in the browser, then click **Confirm & Process with AI**. With the default `AI_BATCH_SIZE=12`, the 26 data rows yield 25 contactable candidates and therefore **3 AI batches**; the pre-scan skips the no-contact row immediately and the owner-only row is skipped after AI owner exclusion. The result screen must show `totalRows: 26`, `batchesProcessed: 3`, and two skipped rows with those exact reasons. Change `AI_BATCH_SIZE=5`, restart the API, and repeat: the same file should now report 5 batches.

Run `corepack pnpm test` to verify normalization, owner-only skips, duplicate AI rows, order preservation, and count invariants. For retry/failure behavior, temporarily set an invalid `GEMINI_MODEL`, import the batch fixture, and confirm all contactable rows return `AI batch failed after retries`; restore `gemini-2.5-flash` afterwards.

## Samples and deployment

`samples/` includes Facebook, real-estate, messy-sales, and GrowEasy-style fixtures covering ambiguous dates, extra contacts, pincodes, generic sources, missing contacts, and owner-only contacts. `docker-compose.yml` starts both apps. Deploy the API to Render using `render.yaml` (long-running batches are a poor fit for short serverless limits), deploy web to Vercel, set `NEXT_PUBLIC_API_URL` to the API, and set `FRONTEND_URL` to the Vercel origin.

## Limitations and next steps

AI mapping requires a configured provider key; imports fail clearly without one. The current endpoint returns a single final response rather than SSE progress. Future work: SSE progress, Claude adapter, larger-file queueing, audit storage, and screenshot documentation.
