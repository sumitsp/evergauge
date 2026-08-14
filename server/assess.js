import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI, { toFile } from "openai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { DOC_TYPE_RUBRICS } from "./rubrics-catalog.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_TEXT_CHARS = 120_000;

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

function modelMean(rawScores) {
  const vals = Object.values(rawScores || {}).filter((n) => n != null && Number.isFinite(Number(n))).map(Number);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
    console.log(`[assess] PDF ${buf.length} bytes · sending original file to both models`);
    return {
      kind: "pdf",
      buffer: buf,
      base64: buf.toString("base64"),
      bytes: buf.length,
      fileName: fileName || "document.pdf",
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
    .map((d) => {
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
          return `Level ${level} [${label}]:\n${g}`;
        })
        .filter(Boolean)
        .join("\n\n");
      return [`### ${d.dim_key}`, guideLines || "(no guides provided)"].join("\n\n");
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

const SYSTEM_PROMPT = `You are EverGauge, an enterprise deliverable quality assessment engine.

Your task is to evaluate an uploaded business deliverable strictly against the rubric provided in the user message.

You are NOT a general document reviewer. You are a rubric-based scoring engine.

Your score must be based only on evidence that is actually present in the uploaded document.

GENERAL SCORING PRINCIPLES

1. RUBRIC IS THE ONLY SCORING STANDARD
- Use the Level 1–5 descriptors provided for each dimension as the scoring standard.
- Do not substitute your own definition of "good", "professional", "high quality", or "institutional".
- A visually impressive or professionally written document must not receive a high score unless it satisfies the specific rubric descriptor.

2. EVIDENCE-BASED SCORING
- Score only what can be verified from the uploaded document.
- Never infer that something exists because it is likely to exist in a professional deliverable.
- Never assume that a number is sourced, reconciled, labelled, or validated unless the document provides evidence of it.
- Never invent pages, slides, tables, calculations, sources, sections, KPIs, or disclosures.

3. CONSERVATIVE SCORING
- When evidence is insufficient to support a higher level, assign the lower supported level.
- Do not give credit for partially satisfied requirements unless the rubric explicitly allows partial satisfaction.
- A higher score should require evidence for the material requirements of that level.
- Do not award Level 5 merely because the document is generally strong.

4. LEVEL SELECTION
For every dimension:
- First determine which rubric requirements are actually satisfied.
- Then select the highest level whose descriptor is fully supported by the document.
- If a Level 4 descriptor contains multiple material requirements and one or more are clearly absent, do not award Level 4 unless the descriptor permits that degree of partial satisfaction.
- If the document falls between two levels, select the lower level.

5. MISSING VS NOT OBSERVED
- If an expected element is not identifiable in the document, treat it as missing/not evidenced.
- Do not assume that absence from extracted text means absence from the document if the element can reasonably be identified elsewhere in the uploaded document.
- Use the document content available to you, including page/slide structure, tables, charts, headings, and visible text.

6. DOCUMENT-WIDE CONSISTENCY
For dimensions involving consistency, reconciliation, repeated figures, or cross-section accuracy:
- Compare repeated information across the document.
- Do not evaluate only one page or section.
- Where possible, verify repeated values, totals, percentages, dates, periods, labels, and terminology.

7. COMPOUND RUBRIC REQUIREMENTS
Some rubric levels contain multiple requirements.
- Evaluate each material requirement independently.
- A score should reflect the overall level of compliance with that descriptor.
- Do not treat one strong feature as sufficient for a level whose descriptor requires several distinct features.

Before assigning a score, internally decompose the selected level's descriptor into its individual material requirements.
For example, if Level 5 contains A + B + C + D, check each: satisfied / not satisfied.
Only assign that level when the material requirements are sufficiently satisfied according to the descriptor.
Do not output this internal checklist. Output only the final score and concise reason.

8. SECTOR-SPECIFIC REQUIREMENTS
- Apply sector-specific requirements only when they are relevant to the document's business/sub-sector.
- If the document clearly belongs to a different sector, do not penalize it for not containing KPIs that are explicitly specific to another sector.
- If the correct sector cannot be determined from the document, do not invent one.

9. REASON QUALITY
Every scored dimension must contain a concise, evidence-based reason.
The reason must:
- identify the key evidence observed;
- explain why that evidence supports the assigned level;
- mention an important missing requirement when that is what prevents a higher score.

Avoid generic statements such as: "Looks good." "Strong document." "Professional." "Good quality."
Prefer statements such as: "Revenue is presented consistently across the financial summary and projections, but several market claims are not accompanied by source citations, which prevents Level 4."

10. NO GENERAL KNOWLEDGE FILL-IN
Do not use external knowledge to fill gaps in the document.
If the document does not provide a required item, treat it as absent unless the rubric explicitly allows inference.

11. OUTPUT
Return valid JSON only.
Do not return markdown.
Do not return explanations outside the JSON object.
Do not add additional keys.
Do not calculate an overall, weighted average, or grade.

For every rubric dimension, return exactly:
{ "score": <integer 1-5>, "reason": "<concise evidence-based explanation>" }

The JSON keys must exactly match the dimension names supplied in the rubric.`;

function buildScoringPrompt(ctx) {
  const aiDims = ctx.dimensions.filter((d) => !d.is_manual);
  const dimKeys = aiDims.map((d) => d.dim_key);

  const instruction = `Evaluate the uploaded document using the rubric below.

DOCUMENT INFORMATION

Document type: ${ctx.documentType}
File: ${ctx.fileName}

IMPORTANT:
- Review the uploaded document as the primary evidence source.
- Evaluate the document against every applicable rubric dimension.
- Do not use external knowledge to fill missing information.
- Do not assume that an element exists because it is standard practice.
- Score conservatively.
- Select the highest rubric level that is fully supported by the evidence.
- If a higher level contains multiple requirements and material requirements are missing, use the lower supported level.

RUBRIC

${buildRubricBlock(aiDims)}

IMPORTANT SCORING INSTRUCTION:
For every dimension, compare the actual document against the Level 1, Level 2, Level 3, Level 4 and Level 5 descriptors before assigning the score.

Do not score based on overall impression.

Required output keys:
${dimKeys.map((k) => JSON.stringify(k)).join(",\n")}

Return JSON only.`;

  return { system: SYSTEM_PROMPT, instruction, dimKeys };
}

function documentUserText(instruction, extracted) {
  const body = extracted.text?.trim();
  const pages = extracted.pages ? ` (${extracted.pages} pages)` : "";
  if (body) return `${instruction}\n\n--- DOCUMENT TEXT${pages} ---\n${body}`;
  return `${instruction}\n\n--- DOCUMENT TEXT ---\n[No extractable text.]`;
}

function scoresFromParsed(ctx, parsed) {
  const rawScores = {};
  const aiNotes = {};

  for (const d of ctx.dimensions) {
    const entry = lookupDimEntry(parsed, d.dim_key);

    if (d.is_manual) {
      rawScores[d.dim_key] = null;
      aiNotes[d.dim_key] = "MANUAL";
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

    const score = clampScore(raw);
    rawScores[d.dim_key] = score;
    aiNotes[d.dim_key] = reason || (score != null ? noteFor(d, score) : "");
  }

  return { rawScores, aiNotes };
}

function roundScore(n) {
  return Math.round(Number(n) * 10) / 10;
}

function averageDualScores(ctx, claude, gpt) {
  const scores = {};
  const aiNotes = {};
  const sources = [claude, gpt].filter(Boolean);

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
      : null;

    const parts = [];
    if (claude?.aiNotes?.[d.dim_key]) parts.push(`Claude: ${claude.aiNotes[d.dim_key]}`);
    if (gpt?.aiNotes?.[d.dim_key]) parts.push(`GPT-4o-mini: ${gpt.aiNotes[d.dim_key]}`);
    aiNotes[d.dim_key] = parts.join("\n") || (scores[d.dim_key] != null ? noteFor(d, scores[d.dim_key]) : "");
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

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content }],
  });

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

  let text = "";
  if (extracted.kind === "pdf" && extracted.buffer) {
    const uploaded = await client.files.create({
      file: await toFile(extracted.buffer, extracted.fileName || "document.pdf", { type: "application/pdf" }),
      purpose: "user_data",
    });
    try {
      const response = await client.responses.create({
        model,
        temperature: 0.2,
        max_output_tokens: 8192,
        instructions: system,
        input: [
          {
            role: "user",
            content: [
              { type: "input_file", file_id: uploaded.id },
              { type: "input_text", text: instruction },
            ],
          },
        ],
        text: { format: { type: "json_object" } },
      });
      text = response.output_text || "";
    } finally {
      await client.files.delete(uploaded.id).catch(() => {});
    }
  } else {
    const message = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: documentUserText(instruction, extracted) },
      ],
    });
    text = message.choices?.[0]?.message?.content || "";
  }

  const parsed = parseJsonPayload(text);
  return { model, ...scoresFromParsed(ctx, parsed) };
}

function finalizeAssessment(ctx, claude, gpt) {
  const { scores, aiNotes, overall } = averageDualScores(ctx, claude, gpt);
  const derived = buildInsightsFromScores(ctx.dimensions, scores, aiNotes);
  const models = [claude?.model, gpt?.model].filter(Boolean);
  const claudeAvg = claude ? modelMean(claude.rawScores) : null;
  const gptAvg = gpt ? modelMean(gpt.rawScores) : null;
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
