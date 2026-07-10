import pLimit from "p-limit";
import { buildCrmRecord, hasContactSignal, type CRMRecord, type CsvRow, type NumberedRow, type SemanticDraft, type SkippedRecord } from "@groweasy/shared";
import type { SemanticProvider } from "./providers.js";

export async function processRows(rows: NumberedRow[], provider: SemanticProvider, settings = { batchSize: Number(process.env.AI_BATCH_SIZE ?? 12), concurrency: Number(process.env.AI_BATCH_CONCURRENCY ?? 2), retries: Number(process.env.AI_MAX_RETRIES ?? 2) }) {
  const skipped: SkippedRecord[] = [], warnings: string[] = [];
  const eligible = rows.filter((item) => {
    if (hasContactSignal(item.row)) return true;
    skipped.push({ rowNumber: item.source_row_number, reason: "Missing email and mobile number", original: item.row as Record<string, string> }); return false;
  });
  const batches = Array.from({ length: Math.ceil(eligible.length / settings.batchSize) }, (_, index) => eligible.slice(index * settings.batchSize, (index + 1) * settings.batchSize));
  const limit = pLimit(settings.concurrency); const drafts = new Map<number, SemanticDraft>();
  await Promise.all(batches.map((batch) => limit(async () => {
    let result: SemanticDraft[] | null = null;
    for (let attempt = 0; attempt <= settings.retries && !result; attempt++) try { result = await provider.extract(batch); } catch (error) { if (attempt === settings.retries) warnings.push(`Batch ${batch[0]?.source_row_number} failed after retries.`); }
    if (!result) { for (const item of batch) skipped.push({ rowNumber: item.source_row_number, reason: "AI batch failed after retries", original: item.row as Record<string, string> }); return; }
    for (const draft of result) { if (!batch.some((item) => item.source_row_number === draft.source_row_number)) continue; if (drafts.has(draft.source_row_number)) { warnings.push(`Duplicate AI row ${draft.source_row_number}; first result kept.`); continue; } drafts.set(draft.source_row_number, draft); }
  })));
  for (const item of eligible) if (!drafts.has(item.source_row_number) && !skipped.some((s) => s.rowNumber === item.source_row_number)) {
    try { const repaired = await provider.repair(item); if (repaired?.source_row_number === item.source_row_number) drafts.set(item.source_row_number, repaired); else throw new Error("missing"); } catch { skipped.push({ rowNumber: item.source_row_number, reason: "Row missing from AI response after repair", original: item.row as Record<string, string> }); }
  }
  const records: CRMRecord[] = [];
  for (const item of eligible) { const draft = drafts.get(item.source_row_number); if (!draft) continue; const record = buildCrmRecord(item.row, draft); if (record) records.push(record); else skipped.push({ rowNumber: item.source_row_number, reason: "Contact info belongs to lead owner only", original: item.row as Record<string, string> }); }
  records.sort((a, b) => 0); skipped.sort((a, b) => a.rowNumber - b.rowNumber);
  const response = { summary: { totalRows: rows.length, imported: records.length, skipped: skipped.length, batchesProcessed: batches.length }, records, skippedRecords: skipped, warnings };
  if (response.summary.totalRows !== response.summary.imported + response.summary.skipped) response.warnings.push("Count invariant warning: imported + skipped differs from total rows.");
  return response;
}
/** Preserves physical CSV row positions (header is line 1), including blank data lines. */
export const numberedRows = (rows: CsvRow[]): NumberedRow[] => rows.flatMap((row, index) => Object.values(row).some((v) => String(v ?? "").trim()) ? [{ source_row_number: index + 2, row }] : []);
