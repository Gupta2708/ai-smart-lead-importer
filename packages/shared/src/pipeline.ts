import { explicitCountryCode, extractEmailsFromRow, extractPhonesFromRow, normalizeDataSource, normalizeDate, normalizeStatus, sanitizeText } from "./normalizers.js";
import type { CRMRecord, CsvRow, SemanticDraft } from "./schemas.js";

export type NumberedRow = { source_row_number: number; row: CsvRow };
export function rawDateForRow(row: CsvRow, draft: SemanticDraft): string {
  const exact = Object.values(row).find((value) => sanitizeText(value) === sanitizeText(draft.created_at_raw));
  if (exact) return exact;
  const named = Object.entries(row).find(([key]) => /(created|lead date|date|timestamp)/i.test(key))?.[1];
  return named ?? "";
}
export function buildCrmRecord(row: CsvRow, draft: SemanticDraft): CRMRecord | null {
  const excludeKeys = draft.lead_owner_column_hint ? [draft.lead_owner_column_hint] : [];
  const emails = extractEmailsFromRow(row, { excludeEmails: [draft.lead_owner_email_hint], excludeKeys });
  const phones = extractPhonesFromRow(row, { excludePhones: [draft.lead_owner_phone_hint], excludeKeys });
  if (!emails.length && !phones.length) return null;
  const extras: string[] = [];
  const note = sanitizeText(draft.crm_note_raw);
  if (note) extras.push(note);
  if (draft.crm_status_raw && !note.toLowerCase().includes(draft.crm_status_raw.toLowerCase())) extras.push(`Original status: ${sanitizeText(draft.crm_status_raw)}`);
  for (const email of emails.slice(1)) extras.push(`Extra email: ${email}`);
  for (const phone of phones.slice(1)) extras.push(`Extra mobile: ${phone.mobile}`);
  const uniqueNotes = extras.filter((part, index) => part && !extras.slice(0, index).some((prior) => prior.toLowerCase() === part.toLowerCase()));
  const primaryPhone = phones[0];
  return {
    created_at: normalizeDate(rawDateForRow(row, draft)), name: sanitizeText(draft.name), email: emails[0] ?? "",
    country_code: primaryPhone ? explicitCountryCode(row) || primaryPhone.country_code : "", mobile_without_country_code: primaryPhone?.mobile ?? "",
    company: sanitizeText(draft.company), city: sanitizeText(draft.city), state: sanitizeText(draft.state), country: sanitizeText(draft.country),
    lead_owner: sanitizeText(draft.lead_owner), crm_status: normalizeStatus(draft.crm_status_raw), crm_note: uniqueNotes.join(". "),
    data_source: normalizeDataSource(draft.data_source_raw), possession_time: sanitizeText(draft.possession_time), description: sanitizeText(draft.description)
  };
}
