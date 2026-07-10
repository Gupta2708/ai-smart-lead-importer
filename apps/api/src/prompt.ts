import type { NumberedRow } from "@groweasy/shared";

export const buildSemanticExtractionPrompt = (rows: NumberedRow[]) => `You are an AI semantic extraction engine for GrowEasy CRM. You receive arbitrary CSV lead rows with inconsistent column names. Return JSON only: {"records":[]}.

Semantic mapping only. Do not split email or phone contacts, append extra contacts to notes, reformat dates, or decide skips. Return every input row.
For each row return source_row_number, created_at_raw (the original value from the selected date cell), name, company, city, state, country, lead_owner, lead_owner_email_hint, lead_owner_phone_hint, lead_owner_column_hint, crm_status_raw, crm_note_raw, data_source_raw, possession_time, description. Use blank strings when unknown.

The lead owner is an assigned agent/executive/rep, not the customer. When its email or phone is clear, return it as a hint and the exact owner column key in lead_owner_column_hint. Notes contain only semantic remarks/comments/messages — never contacts.
Raw status examples: Not Dialed -> DID_NOT_CONNECT category; Interested/Follow Up -> GOOD_LEAD_FOLLOW_UP; Not Interested -> BAD_LEAD; Closed Won -> SALE_DONE. Raw source examples: Meridian Tower -> meridian_tower category, but Facebook/Google Ads are not a GrowEasy project. Do not hallucinate.

Rows to process:\n${JSON.stringify(rows.map(({ source_row_number, row }) => ({ source_row_number, ...row })))}`;

export const buildRepairPrompt = (row: NumberedRow) => `${buildSemanticExtractionPrompt([row])}\nReturn the single missing record exactly now.`;
