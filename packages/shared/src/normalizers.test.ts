import { describe, expect, it } from "vitest";
import { buildCrmRecord } from "./pipeline.js";
import { extractEmailsFromRow, extractPhonesFromRow, normalizeDataSource, normalizeDate, normalizeStatus } from "./normalizers.js";
import type { SemanticDraft } from "./schemas.js";

const blankDraft = (overrides: Partial<SemanticDraft> = {}): SemanticDraft => ({ source_row_number: 2, created_at_raw: "", name: "Amit", company: "", city: "", state: "", country: "", lead_owner: "", lead_owner_email_hint: "", lead_owner_phone_hint: "", crm_status_raw: "", crm_note_raw: "", data_source_raw: "", possession_time: "", description: "", lead_owner_column_hint: "", ...overrides });
describe("deterministic import utilities", () => {
  it("normalizes safe and ambiguous Indian dates", () => { expect(normalizeDate("29-06-2026 10:00")).toBe("2026-06-29T10:00:00"); expect(normalizeDate("06/07/2026 10:00")).toBe("2026-07-06T10:00:00"); expect(normalizeDate("06/29/2026 10:00")).toBe("2026-06-29T10:00:00"); });
  it("extracts emails in order while excluding an owner", () => { expect(extractEmailsFromRow({ Contact: "a@test.com, b@test.com", Executive: "owner@test.com" }, { excludeEmails: ["OWNER@test.com"], excludeKeys: ["Executive"] })).toEqual(["a@test.com", "b@test.com"]); });
  it("only recognizes valid Indian mobile numbers", () => { expect(extractPhonesFromRow({ contact: "+91-98111-22222 / 98222-33333", pin: "560001", order: "ORDER123456", year: "2026" }).map((x) => x.mobile)).toEqual(["9811122222", "9822233333"]); });
  it("uses an explicit country code over the Indian default", () => { const record = buildCrmRecord({ Phone: "9876543210", COUNTRY_CODE: "+44" }, blankDraft()); expect(record?.country_code).toBe("+44"); });
  it("normalizes status and project sources conservatively", () => { expect(normalizeStatus("Not Dialed")).toBe("DID_NOT_CONNECT"); expect(normalizeDataSource("Meridian Tower Phase 2")).toBe("meridian_tower"); expect(normalizeDataSource("Facebook Lead Ads")).toBe(""); });
  it("re-checks contactability after owner exclusion and avoids duplicate extras", () => { expect(buildCrmRecord({ Assigned: "owner@test.com" }, blankDraft({ lead_owner_email_hint: "owner@test.com", lead_owner_column_hint: "Assigned" }))).toBeNull(); const record = buildCrmRecord({ Contact: "a@test.com, b@test.com, 9876543210, 9822233333" }, blankDraft({ crm_note_raw: "Call back" })); expect(record?.crm_note).toBe("Call back. Extra email: b@test.com. Extra mobile: 9822233333"); });
});
