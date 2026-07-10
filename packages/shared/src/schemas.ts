import { z } from "zod";

export const CRM_STATUSES = ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"] as const;
export const DATA_SOURCES = ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"] as const;
export type CRMStatus = (typeof CRM_STATUSES)[number];
export type DataSource = (typeof DATA_SOURCES)[number];
export type CsvRow = Record<string, string | undefined>;
export const crmRecordSchema = z.object({
  created_at: z.string(), name: z.string(), email: z.string(), country_code: z.string(), mobile_without_country_code: z.string(), company: z.string(), city: z.string(), state: z.string(), country: z.string(), lead_owner: z.string(), crm_status: z.enum(CRM_STATUSES).or(z.literal("")), crm_note: z.string(), data_source: z.enum(DATA_SOURCES).or(z.literal("")), possession_time: z.string(), description: z.string()
});
export type CRMRecord = z.infer<typeof crmRecordSchema>;
export const semanticDraftSchema = z.object({
  source_row_number: z.number().int().positive(), created_at_raw: z.string(), name: z.string(), company: z.string(), city: z.string(), state: z.string(), country: z.string(), lead_owner: z.string(), lead_owner_email_hint: z.string(), lead_owner_phone_hint: z.string(), crm_status_raw: z.string(), crm_note_raw: z.string(), data_source_raw: z.string(), possession_time: z.string(), description: z.string(), lead_owner_column_hint: z.string().optional().default("")
});
export type SemanticDraft = z.infer<typeof semanticDraftSchema>;
export const semanticResponseSchema = z.object({ records: z.array(semanticDraftSchema) });
export const skippedRecordSchema = z.object({ rowNumber: z.number().int().positive(), reason: z.string().min(1), original: z.record(z.string()) });
export type SkippedRecord = z.infer<typeof skippedRecordSchema>;
export const importResponseSchema = z.object({ summary: z.object({ totalRows: z.number(), imported: z.number(), skipped: z.number(), batchesProcessed: z.number() }), records: z.array(crmRecordSchema), skippedRecords: z.array(skippedRecordSchema), warnings: z.array(z.string()) });
export type ImportResponse = z.infer<typeof importResponseSchema>;
