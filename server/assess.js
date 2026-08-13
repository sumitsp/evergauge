import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DOC_TYPE_RUBRICS } from "./rubrics-catalog.js";
import { extractText as extractPdfText } from "unpdf";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_TEXT_CHARS = 120_000;
const MAX_PDF_BYTES = 32 * 1024 * 1024;

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
 * Pass Claude scores through unchanged. No average targeting / batch lift —
 * the prompt already requires honest use of the full 1–5 range.
 */
function calibrateScoreBatch(rawScores) {
  const vals = Object.values(rawScores).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  const rawAvg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return { scores: { ...rawScores }, lift: 0, rawAvg };
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

async function pdfPlainText(buf) {
  try {
    const { text, totalPages } = await extractPdfText(new Uint8Array(buf), { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n\n") : String(text || "");
    return { text: joined.slice(0, MAX_TEXT_CHARS), pages: totalPages || 0 };
  } catch (err) {
    console.warn("[assess] PDF text extract failed:", err.message);
    return { text: "", pages: 0 };
  }
}

async function extractDocumentText(filePath, mimeType, fileName) {
  if (!filePath) return { kind: "text", text: "" };
  const buf = await fs.readFile(filePath);
  const ext = path.extname(fileName || filePath).toLowerCase();
  const mime = (mimeType || "").toLowerCase();

  if (mime.includes("pdf") || ext === ".pdf") {
    const extracted = await pdfPlainText(buf);
    const embed = buf.length <= MAX_PDF_BYTES;
    console.log(`[assess] PDF ${buf.length} bytes · ${extracted.pages} pages · ${extracted.text.length} chars · embed=${embed}`);
    return {
      kind: "pdf",
      base64: embed ? buf.toString("base64") : null,
      bytes: buf.length,
      pages: extracted.pages,
      text: extracted.text,
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
        "Use Level 1–5 as the quality ladder. Award the level whose description best matches the balance of observable evidence — not the highest level with a single trace.",
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
    throw new Error("Model response was not valid JSON");
  }
}

function buildScoringPrompt(ctx) {
  const dimKeys = ctx.dimensions.map((d) => d.dim_key);
  const manualDims = ctx.dimensions.filter((d) => d.is_manual);

  const system = `You are EverGauge, Evernile's quality assessment engine. You score investment-banking deliverables (teasers, IMs/CIMs, financial models) against a fixed rubric, the way a demanding but fair managing director marks a real submission: evidence-first, calibrated, and willing to use the full 1–5 range.

## Prime directive
Score only what you can actually observe in the document. Your job is discrimination, not encouragement — a score is useful only if a 4 means something different from a 3. Do NOT target any average. Do NOT smooth scores toward the middle. Let the evidence place each dimension wherever it lands.

## How to score each dimension
1. Read the Level 1–5 descriptors as the definition of that dimension's quality ladder.
2. Extract the specific, observable signals named in the descriptors (e.g. "sum of mix % = 100 on every chart", "8 sections in canonical order", "A/P/E labels on every table", "assertion titles with numbers", "BS balances every year without a plug").
3. Check the document for each signal: present, partial, or absent.
4. Award the level whose description best matches the BALANCE of what you observe — not the highest level you can find a single trace of.

## Anchor and meaning of each score
1 = Poor. The Level-1 failure is genuinely present (broken, unusable, section absent).
2 = Below expectations. Material failure; major rework needed (matches Level-2).
3 = Meets expectations. Core content present and client-reviewable, but generic or incomplete on the high-signal items.
4 = Strong. Most Level-4 markers are observably present; clearly above a competent baseline.
5 = Excellent. The SPECIFIC institutional markers in the Level-5 descriptor are actually visible in the document — not implied, not assumed.
Treat Level 3 as the conceptual midpoint, not a default resting place. Move up only when the higher level's markers are genuinely present; move down when the described failure is genuinely there.

## The 3 / 4 / 5 boundary (where scores wrongly cluster — be strict here)
- Missing/generic high-signal items → 3, even if the document looks polished.
- Most Level-4 markers observed → 4.
- If you are INFERRING the Level-5 markers rather than seeing them, it is a 4, not a 5.

## Guard against unfair harshness (keep narrow)
- Poor or partial text extraction is a technical issue, not a quality failure. Assess what is legible; do not score 1–2 on that basis.
- You see only the deliverable — not the source data room, delivery logs, or iteration history. For any criterion requiring external information (e.g. "every number traces to source doc"), do NOT fabricate verification and do NOT assume the worst. Score the in-document proxy only: internal consistency, presence of source citations and period/basis labels within the document, and whether repeated figures are identical across sections.

## Guard against inflation (equally important)
- An unverifiable claim is not "verified." A number with no stated basis is not "sourced" just because it looks plausible.
- One strong dimension must not halo the others. Score each dimension independently.
- Partial evidence earns partial credit, not full credit. A single trace of a Level-5 marker is not a 5.

## Differentiation
Real deliverables are uneven — a 5 on narrative can sit beside a 2 on financial depth. Nearly identical scores across all dimensions almost always mean you under-differentiated; re-examine each against its own evidence before finalizing.

## Manual dimensions
Dimensions marked MANUAL are scored by a human. Return score: null, reason: "MANUAL".

## Output
Return ONLY valid JSON — no markdown, no code fences, no prose outside the JSON.
Each key = the exact dimension name.
Each value = { "score": <integer 1-5 or null>, "reason": "<Level N: one concrete, dimension-specific observation — name the signal you saw or found missing>" }.
The reason must cite a specific feature of THIS document, not a restatement of the rubric. No two reasons should be interchangeable.`;

  const instruction = `Assess this ${ctx.documentType} against the rubric below, scoring each dimension on observable evidence in the document.

Metadata (context only — must not influence the score):
- Employee / owner: ${ctx.employee}
- Project: ${ctx.project}
- File name: ${ctx.fileName}
- Document type: ${ctx.documentType}

## Rubric (exact JSON keys = dimension names; Level 1-5 descriptors define the quality ladder)
${buildRubricBlock(ctx.dimensions)}

## Procedure (apply per dimension, then emit JSON)
1. From the Level descriptors, identify the specific observable signals for this dimension.
2. Check the document for each: present / partial / absent.
3. Map to the level whose description best matches the balance of evidence — not the highest level with one trace.
4. Write a reason naming the specific signal you observed or found missing.

## Required keys (return these and only these)
${dimKeys.map((k) => JSON.stringify(k)).join(", ")}

Manual (return score null, reason "MANUAL"): ${manualDims.map((d) => d.dim_key).join("; ") || "none"}

## Output shape
{ "<dimension name>": { "score": 4, "reason": "Level 4: ..." }, ... }

## Before finishing
- Scores should vary across dimensions where evidence varies; uniform scores signal under-differentiation.
- Use the full range honestly: 1-2 where the described failure is real, 5 only where Level-5 markers are actually visible.
- Every reason must be specific to this document and non-interchangeable.
- JSON only. Exact dimension names as keys. No text outside the JSON.`;

  return { system, instruction, dimKeys, manualDims };
}

function documentUserText(instruction, extracted) {
  const body = extracted.text?.trim();
  if (body) return `${instruction}\n\n--- DOCUMENT TEXT (${extracted.pages || "?"} pages) ---\n${body}`;
  return `${instruction}\n\n--- DOCUMENT TEXT ---\n[Limited extractable text. This is a technical extraction issue, not a quality failure. Do NOT score 1–2 for unseen pages. Use Level 3 unless failure is obvious from the remaining text.]`;
}

function modelMean(rawScores) {
  const vals = Object.values(rawScores || {}).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function scoresFromParsed(ctx, parsed) {
  const rawScores = {};
  const aiNotes = {};

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
    if (score == null) score = 3;
    rawScores[d.dim_key] = score;
    aiNotes[d.dim_key] = reason || noteFor(d, score);
  }

  return { rawScores, aiNotes };
}

function roundScore(n) {
  return Math.round(Number(n) * 10) / 10;
}

function averageDualScores(ctx, claude, gpt) {
  const scores = {};
  const aiNotes = {};
  const claudeMean = modelMean(claude?.rawScores);
  const gptMean = modelMean(gpt?.rawScores);
  // A model that never saw the file typically dumps 1s. Don't let that pull a real score to 1.
  let useClaude = Boolean(claude);
  let useGpt = Boolean(gpt);
  if (useClaude && useGpt && claudeMean != null && gptMean != null) {
    if (gptMean <= 1.6 && claudeMean >= 2.8) {
      console.warn(`[assess] Ignoring GPT (mean ${gptMean.toFixed(2)}) — looks like a blind/unseen-document score`);
      useGpt = false;
    } else if (claudeMean <= 1.6 && gptMean >= 2.8) {
      console.warn(`[assess] Ignoring Claude (mean ${claudeMean.toFixed(2)}) — looks like a blind/unseen-document score`);
      useClaude = false;
    }
  }
  const sources = [];
  if (useClaude) sources.push(claude);
  if (useGpt) sources.push(gpt);

  for (const d of ctx.dimensions) {
    if (d.is_manual) {
      scores[d.dim_key] = null;
      aiNotes[d.dim_key] = "MANUAL";
      continue;
    }

    const vals = sources
      .map((s) => s.rawScores[d.dim_key])
      .filter((n) => n != null && Number.isFinite(Number(n)))
      .map(Number);

    scores[d.dim_key] = vals.length
      ? roundScore(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 3;

    const parts = [];
    if (useClaude && claude?.aiNotes?.[d.dim_key]) parts.push(`Claude: ${claude.aiNotes[d.dim_key]}`);
    if (useGpt && gpt?.aiNotes?.[d.dim_key]) parts.push(`GPT-4o-mini: ${gpt.aiNotes[d.dim_key]}`);
    aiNotes[d.dim_key] = parts.join("\n") || noteFor(d, scores[d.dim_key]);
  }

  const scored = ctx.dimensions.filter((d) => !d.is_manual).map((d) => scores[d.dim_key]).filter((n) => n != null);
  const overall = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100
    : null;

  return { scores, aiNotes, overall };
}

async function anthropicAssessment(ctx, extracted, prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = String(process.env.ANTHROPIC_MODEL || MODEL).trim() || MODEL;
  console.log(`[assess] Claude model: ${model}`);
  const client = new Anthropic({ apiKey });
  const { system, instruction } = prompt;

  const content = [];
  if (extracted.kind === "pdf" && extracted.base64) {
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
    content.push({ type: "text", text: documentUserText(instruction, extracted) });
  }

  let message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    console.warn("[assess] Claude PDF embed failed, retrying with extracted text:", err.message);
    message = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: [{ type: "text", text: documentUserText(instruction, extracted) }] }],
    });
  }

  const text = (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = parseJsonPayload(text);
  return { model, ...scoresFromParsed(ctx, parsed), usage: message.usage || null };
}

async function openaiAssessment(ctx, extracted, prompt) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = String(process.env.OPENAI_MODEL || OPENAI_MODEL).trim() || OPENAI_MODEL;
  console.log(`[assess] OpenAI model: ${model}`);
  const client = new OpenAI({ apiKey });
  const { system, instruction } = prompt;
  const userText = documentUserText(instruction, extracted);

  const message = await client.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
  });
  const text = message.choices?.[0]?.message?.content || "";
  const parsed = parseJsonPayload(text);
  return { model, ...scoresFromParsed(ctx, parsed) };
}

function finalizeAssessment(ctx, claude, gpt) {
  const { scores, aiNotes, overall } = averageDualScores(ctx, claude, gpt);
  const derived = buildInsightsFromScores(ctx.dimensions, scores, aiNotes);
  const models = [claude?.model, gpt?.model].filter(Boolean);
  const claudeAvg = claude ? calibrateScoreBatch(claude.rawScores).rawAvg : null;
  const gptAvg = gpt ? calibrateScoreBatch(gpt.rawScores).rawAvg : null;
  console.log(
    `[assess] claudeAvg=${claudeAvg != null ? claudeAvg.toFixed(2) : "n/a"} gptAvg=${gptAvg != null ? gptAvg.toFixed(2) : "n/a"} final=${overall} scores=${JSON.stringify(scores)}`
  );

  return {
    scores,
    aiNotes,
    overall,
    strengths: derived.strengths,
    improvements: derived.improvements,
    aiModel: models.length > 1 ? `${models.join(" + ")} avg`.slice(0, 80) : (models[0] || "avg"),
    creditsUsed: models.length,
    pendingManual: ctx.dimensions.filter((d) => d.is_manual).map((d) => d.dim_key),
    modelScores: {
      claude: claude?.rawScores || null,
      openai: gpt?.rawScores || null,
    },
  };
}

/**
 * Score non-manual dimensions via Claude and GPT-4o-mini (same prompt), then average.
 * Always returns a scorable result so the review is saved and visible in Quality Reviews.
 */
export async function runAssessment(ctx, options = {}) {
  const preferAi = options.requireAi !== false;
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (!hasClaude && !hasOpenAi) {
    console.warn("[assess] No ANTHROPIC_API_KEY or OPENAI_API_KEY — using stub scorer");
    const stub = stubAssessment(ctx);
    stub.aiModel = "stub-v1 (no API key)";
    stub.usedStub = true;
    return stub;
  }

  try {
    const extracted = await extractDocumentText(ctx.filePath, ctx.mimeType, ctx.fileName);
    const prompt = buildScoringPrompt(ctx);
    const jobs = [];
    if (hasClaude) jobs.push(anthropicAssessment(ctx, extracted, prompt).then((r) => ({ name: "claude", result: r })));
    if (hasOpenAi) jobs.push(openaiAssessment(ctx, extracted, prompt).then((r) => ({ name: "openai", result: r })));

    const settled = await Promise.allSettled(jobs);
    let claude = null;
    let gpt = null;
    for (const item of settled) {
      if (item.status === "fulfilled") {
        if (item.value.name === "claude") claude = item.value.result;
        if (item.value.name === "openai") gpt = item.value.result;
      } else {
        console.error("[assess] model failed:", item.reason?.message || item.reason);
      }
    }

    if (!claude && !gpt) throw new Error("Both Claude and OpenAI scoring failed");

    const result = finalizeAssessment(ctx, claude, gpt);
    result.usedStub = false;
    return result;
  } catch (err) {
    console.error("[assess] Dual scoring failed:", err.message);
    if (preferAi && String(process.env.REQUIRE_ANTHROPIC || "").toLowerCase() === "true") {
      throw err;
    }
    console.warn("[assess] Falling back to stub scorer");
    const stub = stubAssessment(ctx);
    const reason = String(err.message || "scoring error").slice(0, 40);
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
