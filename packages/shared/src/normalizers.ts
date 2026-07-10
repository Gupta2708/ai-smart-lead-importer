import { format, isValid, parse } from "date-fns";
import type { CRMStatus, CsvRow, DataSource } from "./schemas.js";

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneCandidate = /(?:\+?91[\s().-]*)?[6-9](?:[\s().-]*\d){9}(?!\d)/g;
const clean = (value: unknown) => String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const normalizedDigits = (value: string) => value.replace(/\D/g, "");

export function normalizeDate(input: string): string {
  const value = clean(input);
  if (!value) return "";
  const formats = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm", "dd-MM-yyyy HH:mm", "dd/MM/yyyy HH:mm", "MM/dd/yyyy HH:mm", "dd-MM-yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "MMM d, yyyy h:mm a", "MMM d, yyyy h a"];
  const ambiguous = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
  const ordered = ambiguous ? (() => {
    const [, a, b] = ambiguous;
    if (Number(a) > 12) return formats.filter((f) => f.startsWith("dd/" ) || f.startsWith("dd-"));
    if (Number(b) > 12) return formats.filter((f) => f.startsWith("MM/"));
    return formats.filter((f) => f.startsWith("dd/"));
  })() : formats;
  for (const pattern of ordered) {
    const parsed = parse(value, pattern, new Date(0));
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return "";
}

export function extractEmailsFromRow(row: CsvRow, options: { excludeEmails?: string[]; excludeKeys?: string[] } = {}): string[] {
  const excluded = new Set((options.excludeEmails ?? []).map((e) => clean(e).toLowerCase()).filter(Boolean));
  const keys = new Set((options.excludeKeys ?? []).map((k) => k.toLowerCase()));
  const found: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (keys.has(key.toLowerCase())) continue;
    for (const email of clean(value).match(emailPattern) ?? []) {
      const normalized = email.toLowerCase();
      if (!excluded.has(normalized) && !found.some((item) => item.toLowerCase() === normalized)) found.push(email);
    }
  }
  return found;
}

export type NormalizedPhone = { country_code: string; mobile: string };
export function extractPhonesFromRow(row: CsvRow, options: { excludePhones?: string[]; excludeKeys?: string[] } = {}): NormalizedPhone[] {
  const excluded = new Set((options.excludePhones ?? []).map(normalizedDigits).map((x) => x.replace(/^91(?=[6-9]\d{9}$)/, "")).filter(Boolean));
  const keys = new Set((options.excludeKeys ?? []).map((k) => k.toLowerCase()));
  const found: NormalizedPhone[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (keys.has(key.toLowerCase())) continue;
    for (const candidate of clean(value).match(phoneCandidate) ?? []) {
      const digits = normalizedDigits(candidate);
      const mobile = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
      if (!/^[6-9]\d{9}$/.test(mobile) || excluded.has(mobile) || found.some((p) => p.mobile === mobile)) continue;
      found.push({ country_code: "+91", mobile });
    }
  }
  return found;
}

export function explicitCountryCode(row: CsvRow): string {
  for (const [key, value] of Object.entries(row)) {
    if (!/(country[ _-]?code|dial[ _-]?code|phone[ _-]?code)/i.test(key)) continue;
    const digits = normalizedDigits(clean(value));
    if (/^\d{1,3}$/.test(digits) && digits !== "0") return `+${digits}`;
  }
  return "";
}
export function normalizeStatus(input: string): CRMStatus | "" {
  const value = clean(input).toLowerCase();
  if (!value) return "";
  if (/(not interested|invalid|junk|wrong number|disqualified|bad lead)/.test(value)) return "BAD_LEAD";
  if (/(closed|converted|sold|sale done|booked|closed won)/.test(value)) return "SALE_DONE";
  if (/(not dialed|not called|not connected|no answer|busy|unreachable|call later|did not connect)/.test(value)) return "DID_NOT_CONNECT";
  if (/(interested|follow up|warm|qualified|callback|good lead|demo reschedule|reschedule demo)/.test(value)) return "GOOD_LEAD_FOLLOW_UP";
  return "";
}
export function normalizeDataSource(input: string): DataSource | "" {
  const value = clean(input).toLowerCase();
  if (/(facebook|google ads|real estate campaign|website lead|instagram)/.test(value)) return "";
  if (/(meridian\s*tower)/.test(value)) return "meridian_tower";
  if (/(eden\s*park)/.test(value)) return "eden_park";
  if (/(varah\s*swamy)/.test(value)) return "varah_swamy";
  if (/(sarjapur\s*plot)/.test(value)) return "sarjapur_plots";
  if (/(leads?\s*on\s*demand|\blod\b)/.test(value)) return "leads_on_demand";
  return "";
}
export const hasContactSignal = (row: CsvRow) => extractEmailsFromRow(row).length > 0 || extractPhonesFromRow(row).length > 0;
export const sanitizeText = clean;
