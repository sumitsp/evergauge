import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DOC_TYPE_RUBRICS } from "./rubrics-catalog.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TEXT_CHARS = 120_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function hashString(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function scoreFor(dimKey, seed) {
  // Stub only — intentionally spread 2–4, not clustered at 4
  const base = 2.2 + ((seed % 17) / 17) * 1.8;
  const wobble = ((seed >> 3) % 7) * 0.08 - 0.24;
  const raw = base + wobble + (dimKey.length % 5) * 0.03;
  return Math.max(1, Math.min(4, Math.round(raw)));
}

function noteFor(dim, score) {
  const guides = [dim.guide_1, dim.guide_2, dim.guide_3, dim.guide_4, dim.guide_5].filter(Boolean);
  if (!guides.length) return `Scored ${score}/5 on ${dim.dim_key}.`;
  const idx = Math.min(4, Math.max(0, Math.round(score) - 1));
  return guides[idx] || guides[guides.length - 1];
}

function cleanInsightText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^[-•*\d.)\s]+/, "")
    .trim();
}

function shortenNote(note, max = 140) {
  const t = cleanInsightText(note);
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Build strengths / improvements from real dimension scores (not random banks). */
export function buildInsightsFromScores(dimensions, scores, aiNotes) {
  const rows = (dimensions || [])
    .filter((d) => !d.is_manual && scores?.[d.dim_key] != null)
    .map((d) => ({
      key: d.dim_key,
      score: Number(scores[d.dim_key]),
      note: aiNotes?.[d.dim_key] || "",
    }))
    .filter((r) => Number.isFinite(r.score))
    .sort((a, b) => b.score - a.score);

  const strengthRows = rows.filter((r) => r.score >= 4).slice(0, 3);
  const improveRows = [...rows].filter((r) => r.score <= 3).sort((a, b) => a.score - b.score).slice(0, 3);

  const strengths = (strengthRows.length ? strengthRows : rows.slice(0, 2)).map((r) => {
    const tip = shortenNote(r.note);
    return tip
      ? `${r.key} · ${r.score}/5 — ${tip}`
      : `${r.key} scored ${r.score}/5 and is among the stronger dimensions on this deliverable.`;
  });

  const improvements = (improveRows.length ? improveRows : [...rows].reverse().slice(0, 2)).map((r) => {
    const tip = shortenNote(r.note);
    return tip
      ? `${r.key} · ${r.score}/5 — ${tip}`
      : `Raise ${r.key} toward Level 5; currently ${r.score}/5.`;
  });

  return {
    strengths: [...new Set(strengths.filter(Boolean))].slice(0, 3),
    improvements: [...new Set(improvements.filter(Boolean))].slice(0, 3),
  };
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  // AI rubric scores are integers 1–5
  return Math.max(1, Math.min(5, Math.round(v)));
}

/** Normalize dimension keys for fuzzy matching (Claude sometimes tweaks punctuation). */
function normKey(k) {
  return String(k || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lookupDimEntry(parsed, dimKey) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed[dimKey] != null) return parsed[dimKey];
  const target = normKey(dimKey);
  for (const [k, v] of Object.entries(parsed)) {
    if (k === "scores" || k === "notes") continue;
    if (normKey(k) === target) return v;
  }
  const nested = parsed.scores;
  if (nested && typeof nested === "object") {
    if (nested[dimKey] != null) return { score: nested[dimKey], reason: parsed.notes?.[dimKey] };
    for (const [k, v] of Object.entries(nested)) {
      if (normKey(k) === target) {
        return { score: v, reason: parsed.notes?.[k] || parsed.notes?.[dimKey] };
      }
    }
  }
  return null;
}

/**
 * Claude literal-matches exacting Level-1/2 guide text and undershoots.
 * Lift only when the batch average is below the fair sweet spot (~3.3–4.2).
 */
function calibrateScoreBatch(rawScores) {
  const vals = Object.values(rawScores).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  if (!vals.length) return { scores: rawScores, lift: 0, rawAvg: null };
  const rawAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
  let lift = 0;
  if (rawAvg < 2.4) lift = 2;
  else if (rawAvg < 3.15) lift = 1;
  if (!lift) return { scores: rawScores, lift: 0, rawAvg };

  const out = {};
  for (const [k, v] of Object.entries(rawScores)) {
    if (v == null || !Number.isFinite(Number(v))) {
      out[k] = v;
      continue;
    }
    // Floor at 3 after a lift — 1–2 reserved for truly broken work after calibration
    out[k] = Math.min(5, Math.max(3, Math.round(Number(v) + lift)));
  }
  return { scores: out, lift, rawAvg };
}

function stubAssessment(ctx) {
  const seed = hashString(`${ctx.fileName}|${ctx.project}|${ctx.documentType}|${ctx.employee}`);
  const scores = {};
  const aiNotes = {};
  const scoredValues = [];

  for (let i = 0; i < ctx.dimensions.length; i++) {
    const d = ctx.dimensions[i];
    if (d.is_manual) {
      scores[d.dim_key] = null;
      aiNotes[d.dim_key] = "MANUAL";
      continue;
    }
    const dimSeed = (seed + i * 97 + hashString(d.dim_key)) >>> 0;
    const score = clampScore(scoreFor(d.dim_key, dimSeed));
    scores[d.dim_key] = score;
    aiNotes[d.dim_key] = noteFor(d, score);
    scoredValues.push(score);
  }

  const overall = scoredValues.length
    ? Math.round((scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length) * 100) / 100
    : null;

  const insights = buildInsightsFromScores(ctx.dimensions, scores, aiNotes);

  return {
    scores,
    aiNotes,
    overall,
    strengths: insights.strengths,
    improvements: insights.improvements,
    aiModel: "meridian-qa-stub-v1",
    creditsUsed: 1,
    pendingManual: ctx.dimensions.filter((d) => d.is_manual).map((d) => d.dim_key),
  };
}

async function extractPptxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts = [];
  for (const name of slides) {
    const xml = await zip.files[name].async("string");
    const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
    if (texts.length) parts.push(texts.join(" "));
  }
  return parts.join("\n\n");
}

async function extractDocumentText(filePath, mimeType, fileName) {
  if (!filePath) return { kind: "text", text: "" };
  const buf = await fs.readFile(filePath);
  const ext = path.extname(fileName || filePath).toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.includes("pdf") || ext === ".pdf") {
    if (buf.length <= MAX_PDF_BYTES) {
      return { kind: "pdf", base64: buf.toString("base64"), bytes: buf.length };
    }
    return {
      kind: "text",
      text: `[PDF is ${buf.length} bytes — too large to embed. Score conservatively from file name/metadata only, or ask the user to upload a smaller PDF.]`,
    };
  }

  if (mime.includes("wordprocessingml") || ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return { kind: "text", text: String(result.value || "").slice(0, MAX_TEXT_CHARS) };
  }

  if (mime.includes("spreadsheetml") || ext === ".xlsx" || ext === ".xls") {
    const wb = XLSX.read(buf, { type: "buffer" });
    const chunks = wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name];
      return `## Sheet: ${name}\n${XLSX.utils.sheet_to_csv(sheet)}`;
    });
    return { kind: "text", text: chunks.join("\n\n").slice(0, MAX_TEXT_CHARS) };
  }

  if (mime.includes("presentationml") || ext === ".pptx") {
    const text = await extractPptxText(buf);
    return { kind: "text", text: text.slice(0, MAX_TEXT_CHARS) };
  }

  // Plain / unknown: best-effort utf8
  try {
    return { kind: "text", text: buf.toString("utf8").slice(0, MAX_TEXT_CHARS) };
  } catch {
    return { kind: "text", text: "" };
  }
}

function buildRubricBlock(dimensions) {
  return dimensions
    .map((d, i) => {
      const guides = [d.guide_1, d.guide_2, d.guide_3, d.guide_4, d.guide_5];
      const guideLines = guides
        .map((g, gi) => {
          if (!g) return null;
          const level = gi + 1;
          const label =
            level === 1 ? "POOR" :
            level === 2 ? "BELOW EXPECTATIONS" :
            level === 3 ? "MEETS EXPECTATIONS (baseline)" :
            level === 4 ? "STRONG" :
            "EXCELLENT";
          return `  Level ${level} [${label}]: ${g}`;
        })
        .filter(Boolean)
        .join("\n");
      return [
        `### ${d.dim_key}${d.is_manual ? " [MANUAL — score must be null]" : ""}`,
        "Match the SPIRIT of the Level (illustrative descriptors, not a literal checklist). Start at Level 3; move up or down only with clear evidence. Prefer the higher Level on a close call.",
        guideLines || "  (no guides provided)",
      ].join("\n");
    })
    .join("\n\n");
}

function parseJsonPayload(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch { /* fall through */ }
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Anthropic response was not valid JSON");
  }
}

async function anthropicAssessment(ctx, extracted) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = String(process.env.ANTHROPIC_MODEL || MODEL).trim() || MODEL;
  console.log(`[assess] Claude model: ${model}`);
  const client = new Anthropic({ apiKey });
  const scoredDims = ctx.dimensions.filter((d) => !d.is_manual);
  const manualDims = ctx.dimensions.filter((d) => d.is_manual);
  const dimKeys = ctx.dimensions.map((d) => d.dim_key);
  const exampleKeys = scoredDims.slice(0, 2).map((d) => d.dim_key);
  const exampleManual = manualDims[0]?.dim_key || "Turnaround Time";

  const system = `You are EverGauge, Evernile's quality assessment engine. Score like a fair managing director reviewing a real IB deliverable — constructive, not punitive.

## Hard calibration rules (follow exactly)

1. Level 3 is the DEFAULT starting point for every dimension.
2. Score 1 or 2 ONLY when the document clearly matches that Level's failure description (broken, unusable, or missing the section entirely). Ordinary gaps, missing citations you cannot verify, or imperfect polish are NOT Level 1–2.
3. A recognizable professional draft that a client could review should score mostly 3s and 4s. Overall average should typically land near 3.5–4.0.
4. Treat Level guides as SPIRIT / illustrative descriptors — not literal checklists. Partial evidence for a Level is enough to award it.
5. On a close call between two Levels, choose the HIGHER one.
6. Level 4 is appropriate for clear strengths. Level 5 is uncommon but OK when clearly earned.
7. Do not invent content that is not in the document.
8. Differentiate dimensions by evidence — avoid identical scores on every dimension.
9. If the PDF/text is hard to read or incomplete extraction, assume Level 3 (not 1–2) unless failure is obvious.

## Score meanings

* 1 = Poor — deliverable is broken / unusable on this dimension
* 2 = Below Expectations — material failure; would require major rework
* 3 = Meets Expectations — competent / usable (DEFAULT)
* 4 = Strong — clearly above average
* 5 = Excellent — outstanding

## Manual dimensions

Dimensions marked MANUAL: score null, reason "MANUAL".

## Output

Return ONLY valid JSON. No markdown, no code fences, no prose outside JSON.

Each key = exact dimension name. Each value = { "score": <integer 1-5 or null>, "reason": "<Level N: short evidence-based justification>" }.`;

  const instruction = `Assess this ${ctx.documentType} fairly. Start every dimension at Level 3, then adjust.

Metadata (context only):
- Employee / owner: ${ctx.employee}
- Project: ${ctx.project}
- File name: ${ctx.fileName}
- Document type: ${ctx.documentType}

## Rubric (exact JSON keys = dimension names)

${buildRubricBlock(ctx.dimensions)}

## Required keys (and only these)

${dimKeys.map((k) => JSON.stringify(k)).join(", ")}

Manual (score null): ${manualDims.map((d) => d.dim_key).join("; ") || "none"}

## Output shape example

{
  ${exampleKeys[0] ? JSON.stringify(exampleKeys[0]) : '"Dimension A"'}: { "score": 4, "reason": "Level 4: <brief evidence>." },
  ${exampleKeys[1] ? JSON.stringify(exampleKeys[1]) : '"Dimension B"'}: { "score": 3, "reason": "Level 3: <brief evidence>." },
  ${JSON.stringify(exampleManual)}: { "score": null, "reason": "MANUAL" }
}

## Checklist

- Mostly 3s and 4s for a real professional draft. Do NOT return a batch of 1s/2s.
- JSON only. Exact dimension names as keys.`;

  const content = [];
  if (extracted.kind === "pdf") {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: extracted.base64,
      },
    });
    content.push({ type: "text", text: instruction });
  } else {
    const body = extracted.text?.trim()
      ? `${instruction}\n\n--- DOCUMENT TEXT ---\n${extracted.text}`
      : `${instruction}\n\n--- DOCUMENT TEXT ---\n[Limited extractable text. Default each dimension to Level 3 unless failure is obvious from metadata/filename.]`;
    content.push({ type: "text", text: body });
  }

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content }],
  });

  const text = (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = parseJsonPayload(text);
  const rawScores = {};
  const aiNotes = {};
  const scoredValues = [];

  for (const d of ctx.dimensions) {
    const entry = lookupDimEntry(parsed, d.dim_key);
    const legacyNote = parsed?.notes?.[d.dim_key];

    if (d.is_manual) {
      rawScores[d.dim_key] = null;
      aiNotes[d.dim_key] =
        (entry && typeof entry === "object" && entry.reason) ||
        legacyNote ||
        "MANUAL";
      continue;
    }

    let raw = null;
    let reason = "";
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      raw = entry.score;
      reason = entry.reason || "";
    } else if (entry != null && typeof entry !== "object") {
      raw = entry;
    }

    let score = clampScore(raw);
    // Missing/unparsed → Level 3 baseline, not random stub
    if (score == null) score = 3;
    rawScores[d.dim_key] = score;
    aiNotes[d.dim_key] = reason || noteFor(d, score);
  }

  const { scores, lift, rawAvg } = calibrateScoreBatch(rawScores);
  for (const d of scoredDims) {
    scoredValues.push(scores[d.dim_key]);
  }

  const overall = scoredValues.length
    ? Math.round((scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length) * 100) / 100
    : null;

  console.log(
    `[assess] rawAvg=${rawAvg != null ? rawAvg.toFixed(2) : "n/a"} lift=+${lift} overall=${overall} scores=${JSON.stringify(scores)}`
  );

  const derived = buildInsightsFromScores(ctx.dimensions, scores, aiNotes);

  return {
    scores,
    aiNotes,
    overall,
    strengths: derived.strengths,
    improvements: derived.improvements,
    aiModel: model,
    creditsUsed: 1,
    pendingManual: manualDims.map((d) => d.dim_key),
    usage: message.usage || null,
  };
}

/**
 * Score non-manual dimensions via Anthropic using DB rubric guides + uploaded file.
 * Always returns a scorable result so the review is saved and visible in Quality Reviews.
 * Uses Claude when ANTHROPIC_API_KEY is set; otherwise rubric stub scoring.
 */
export async function runAssessment(ctx, options = {}) {
  const preferAi = options.requireAi !== false;
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  if (!hasKey) {
    console.warn("[assess] ANTHROPIC_API_KEY missing — using stub scorer (review still saved)");
    const stub = stubAssessment(ctx);
    stub.aiModel = "stub-v1 (no API key)";
    stub.usedStub = true;
    return stub;
  }

  try {
    const extracted = await extractDocumentText(ctx.filePath, ctx.mimeType, ctx.fileName);
    const result = await anthropicAssessment(ctx, extracted);
    result.usedStub = false;
    return result;
  } catch (err) {
    console.error("[assess] Anthropic scoring failed:", err.message);
    if (preferAi && String(process.env.REQUIRE_ANTHROPIC || "").toLowerCase() === "true") {
      throw err;
    }
    console.warn("[assess] Falling back to stub scorer");
    const stub = stubAssessment(ctx);
    const reason = String(err.message || "anthropic error").slice(0, 40);
    stub.aiModel = `stub-fallback (${reason})`.slice(0, 80);
    stub.usedStub = true;
    return stub;
  }
}

export function averageScores(scoreList) {
  const vals = (scoreList || [])
    .filter((s) => s != null && s !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}

export function formatBytes(n) {
  if (n == null) return null;
  const num = Number(n);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

export function allowedDocType(name) {
  return DOC_TYPE_RUBRICS.find((d) => d.name === name) || null;
}
