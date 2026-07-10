import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import Papa from "papaparse";
import { createProvider } from "./providers.js";
import { numberedRows, processRows } from "./import-service.js";

// Resolve from this source file so pnpm filters, terminals, and Docker all load the same root .env.
dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const app = express(); const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024;
const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, "");
const configuredOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",").map(normalizeOrigin).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  // Next may select 3001/3002 when a local port is occupied; allow that local-only variation.
  const requestedOrigin = origin ? normalizeOrigin(origin) : "";
  if (!origin || configuredOrigins.includes(requestedOrigin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(requestedOrigin)) return callback(null, true);
  console.warn(`Rejected CORS origin: ${origin}. Allowed origins: ${configuredOrigins.join(", ")}`);
  return callback(new Error(`Origin ${origin} is not allowed. Set FRONTEND_URL to this deployed web origin.`));
} }));
app.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_IP_PER_MIN ?? 5), standardHeaders: "draft-7", legacyHeaders: false }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes }, fileFilter: (_req, file, cb) => cb(null, file.mimetype.includes("csv") || file.originalname.toLowerCase().endsWith(".csv")) });
app.get("/health", (_req, res) => {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  res.json({ ok: true, aiProvider: provider, aiConfigured: Boolean(key?.trim()) });
});
app.post("/api/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A CSV file is required." });
    const parsed = Papa.parse<Record<string, string>>(req.file.buffer.toString("utf8"), { header: true, skipEmptyLines: false });
    // Keep blank lines for physical row-number accounting, but do not reject a CSV
    // solely because its final newline becomes an empty, one-field record.
    const meaningfulErrors = parsed.errors.filter((error) => {
      if (error.type !== "FieldMismatch") return true;
      const sourceRow = parsed.data[error.row ?? -1];
      return Object.values(sourceRow ?? {}).some((value) => String(value ?? "").trim());
    });
    if (meaningfulErrors.length) return res.status(400).json({ error: `CSV parsing failed: ${meaningfulErrors[0].message}` });
    const result = await processRows(numberedRows(parsed.data), createProvider()); return res.json(result);
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Import failed." }); }
});
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(400).json({ error: error.message }));
app.listen(Number(process.env.PORT ?? 4000), () => console.log(`GrowEasy API listening on ${process.env.PORT ?? 4000}`));
