import { semanticResponseSchema, type NumberedRow, type SemanticDraft } from "@groweasy/shared";
import { buildSemanticExtractionPrompt, buildRepairPrompt } from "./prompt.js";

export interface SemanticProvider { extract(rows: NumberedRow[]): Promise<SemanticDraft[]>; repair(row: NumberedRow): Promise<SemanticDraft | null>; }
const parse = (content: string) => semanticResponseSchema.parse(JSON.parse(content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""))).records;
class HttpProvider implements SemanticProvider {
  constructor(private request: (prompt: string) => Promise<string>) {}
  async extract(rows: NumberedRow[]) { return parse(await this.request(buildSemanticExtractionPrompt(rows))); }
  async repair(row: NumberedRow) { const records = parse(await this.request(buildRepairPrompt(row))); return records[0] ?? null; }
}
export function createProvider(): SemanticProvider {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY?.trim(); if (!key) throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
    return new HttpProvider(async (prompt) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, max_tokens: 8000 }) });
      if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`); const json = await response.json() as { choices: { message: { content: string } }[] }; return json.choices[0]?.message.content ?? "";
    });
  }
  const key = process.env.GEMINI_API_KEY?.trim(); if (!key) throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
  return new HttpProvider(async (prompt) => {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 } }) });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`); const json = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }; return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  });
}
