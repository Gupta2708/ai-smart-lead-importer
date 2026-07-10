import { describe, expect, it } from "vitest";
import type { SemanticProvider } from "./providers.js";
import { processRows } from "./import-service.js";

const provider: SemanticProvider = {
  extract: async () => [
    { source_row_number: 3, created_at_raw: "", name: "Second", company: "", city: "", state: "", country: "", lead_owner: "", lead_owner_email_hint: "", lead_owner_phone_hint: "", lead_owner_column_hint: "", crm_status_raw: "Interested", crm_note_raw: "", data_source_raw: "", possession_time: "", description: "" },
    { source_row_number: 2, created_at_raw: "", name: "First", company: "", city: "", state: "", country: "", lead_owner: "", lead_owner_email_hint: "", lead_owner_phone_hint: "", lead_owner_column_hint: "", crm_status_raw: "Not Dialed", crm_note_raw: "", data_source_raw: "", possession_time: "", description: "" },
    { source_row_number: 2, created_at_raw: "", name: "Duplicate", company: "", city: "", state: "", country: "", lead_owner: "", lead_owner_email_hint: "", lead_owner_phone_hint: "", lead_owner_column_hint: "", crm_status_raw: "", crm_note_raw: "", data_source_raw: "", possession_time: "", description: "" }
  ], repair: async () => null
};
describe("processRows", () => {
  it("preserves input order, warns for duplicates, and keeps count invariants", async () => {
    const result = await processRows([{ source_row_number: 2, row: { Email: "one@test.com" } }, { source_row_number: 3, row: { Phone: "9876543210" } }, { source_row_number: 4, row: { Pincode: "560001" } }], provider, { batchSize: 10, concurrency: 1, retries: 0 });
    expect(result.records.map((record) => record.name)).toEqual(["First", "Second"]);
    expect(result.skippedRecords[0]?.reason).toBe("Missing email and mobile number");
    expect(result.warnings.some((warning) => warning.includes("Duplicate"))).toBe(true);
    expect(result.summary.imported + result.summary.skipped).toBe(result.summary.totalRows);
  });
  it("splits more rows than a batch size and reports the actual batch count", async () => {
    let calls = 0;
    const batches: SemanticProvider = { extract: async (rows) => { calls++; return rows.map(({ source_row_number }) => ({ source_row_number, created_at_raw: "", name: `Lead ${source_row_number}`, company: "", city: "", state: "", country: "", lead_owner: "", lead_owner_email_hint: "", lead_owner_phone_hint: "", lead_owner_column_hint: "", crm_status_raw: "", crm_note_raw: "", data_source_raw: "", possession_time: "", description: "" })); }, repair: async () => null };
    const rows = Array.from({ length: 13 }, (_, index) => ({ source_row_number: index + 2, row: { Email: `lead${index}@example.com` } }));
    const result = await processRows(rows, batches, { batchSize: 5, concurrency: 2, retries: 0 });
    expect(calls).toBe(3); expect(result.summary.batchesProcessed).toBe(3); expect(result.summary.imported).toBe(13);
  });
});
