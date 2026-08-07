import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import pool from "./db.js";
import {
  authMiddleware,
  requireAdmin,
  listDirectory,
  createSession,
  destroySession,
  getMemberProjectIds,
  isProjectMember,
  formatUserRow,
  findUserByEmail,
  findUserById,
  getUserPasswordHash,
  resolveGoogleUser,
} from "./auth.js";
import { verifyPassword } from "./passwords.js";
import { OAuth2Client } from "google-auth-library";
import { initSchema, seedIfEmpty, syncEvernileRubrics, seedImaAccess, ensureCoreEmployees, seedAuthCredentials } from "./schema.js";
import { runAssessment, formatBytes, averageScores, allowedDocType, buildInsightsFromScores } from "./assess.js";
import { DOC_TYPE_NAMES } from "./rubrics-catalog.js";
import { assertPortFree } from "./port.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const app = express();
app.use(cors({ exposedHeaders: ["X-Session-Token"] }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use(authMiddleware);

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function parseJsonField(v) {
  if (v == null) return [];
  let parsed = v;
  if (typeof v === "string") {
    try { parsed = JSON.parse(v); } catch { return []; }
  }
  if (Array.isArray(parsed)) {
    return parsed.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean);
  }
  return parsed;
}

async function getSetting(key, fallback = null) {
  const [rows] = await pool.query(
    `SELECT setting_value FROM app_settings WHERE setting_key = :key`,
    { key }
  );
  return rows.length ? rows[0].setting_value : fallback;
}

async function setSetting(key, value) {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (:key, :value)
     ON DUPLICATE KEY UPDATE setting_value = :value`,
    { key, value: String(value) }
  );
}

async function bumpCredits(n = 1) {
  const used = Number(await getSetting("ai_credits_used", "0")) + n;
  await setSetting("ai_credits_used", used);
  return used;
}

async function addNotification(title, body) {
  await pool.query(
    `INSERT INTO notifications (title, body) VALUES (:title, :body)`,
    { title, body }
  );
}

async function getOrCreateProject(name, unit, client = "Confidential") {
  const [rows] = await pool.query("SELECT id FROM projects WHERE name = :name", { name });
  if (rows.length) return rows[0].id;
  const [res] = await pool.query(
    `INSERT INTO projects (name, client, unit) VALUES (:name, :client, :unit)`,
    { name, client, unit }
  );
  return res.insertId;
}

async function getOrCreateDocType(name) {
  const allowed = allowedDocType(name);
  if (!allowed) {
    throw new Error(`Document type must be one of: ${DOC_TYPE_NAMES.join(", ")}`);
  }
  const [rows] = await pool.query("SELECT id FROM document_types WHERE name = :name", { name: allowed.name });
  if (rows.length) return rows[0].id;
  const [res] = await pool.query(
    `INSERT INTO document_types (name, short_label, sla_days, sla_note)
     VALUES (:name, :short_label, :sla_days, :sla_note)`,
    {
      name: allowed.name,
      short_label: allowed.short_label,
      sla_days: allowed.sla_days,
      sla_note: allowed.sla_note,
    }
  );
  return res.insertId;
}

async function loadRubricsByDocType() {
  const [docs] = await pool.query(
    `SELECT id, name, short_label, sla_days, sla_note FROM document_types ORDER BY FIELD(name, ${DOC_TYPE_NAMES.map(() => "?").join(",")})`,
    DOC_TYPE_NAMES
  );
  const [dims] = await pool.query(
    `SELECT id, document_type_id, dim_key AS \`key\`, description AS \`desc\`, weight,
            enabled AS \`on\`, is_manual, sort_order,
            guide_1, guide_2, guide_3, guide_4, guide_5
     FROM rubric_dimensions WHERE enabled = 1 ORDER BY sort_order`
  );
  return docs.map((d) => ({
    id: d.id,
    name: d.name,
    short_label: d.short_label,
    sla_days: d.sla_days,
    sla_note: d.sla_note,
    dimensions: dims
      .filter((x) => x.document_type_id === d.id)
      .map((r) => ({
        id: r.id,
        key: r.key,
        desc: r.desc,
        weight: Number(r.weight),
        on: Boolean(r.on),
        is_manual: Boolean(r.is_manual),
        guides: [r.guide_1, r.guide_2, r.guide_3, r.guide_4, r.guide_5].filter(Boolean),
      })),
  }));
}

async function employeeStats() {
  const [rows] = await pool.query(`
    SELECT
      e.id, e.name, e.unit, e.initials AS init,
      ROUND(COALESCE(AVG(r.overall_score), 0), 1) AS avg,
      COUNT(r.id) AS reviews,
      COUNT(DISTINCT r.project_id) AS projects,
      ROUND(COALESCE(MAX(r.overall_score), 0), 1) AS best,
      ROUND(COALESCE(MIN(CASE WHEN r.overall_score IS NOT NULL THEN r.overall_score END), 0), 1) AS low,
      ROUND(
        COALESCE(AVG(CASE WHEN r.review_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN r.overall_score END), 0) -
        COALESCE(AVG(CASE WHEN r.review_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND r.review_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) THEN r.overall_score END), 0)
      , 1) AS trend,
      ROUND(
        CASE WHEN COUNT(r.id) = 0 THEN COALESCE(e.ready_pct, 0)
             ELSE LEAST(98, GREATEST(35, AVG(r.overall_score) * 18 + COUNT(r.id) * 0.8))
        END, 0
      ) AS ready,
      ROUND(
        CASE WHEN COUNT(r.id) <= 1 THEN COALESCE(e.consistency_pct, 80)
             ELSE LEAST(99, GREATEST(40, 100 - (MAX(r.overall_score) - MIN(r.overall_score)) * 28))
        END, 0
      ) AS consistency
    FROM employees e
    LEFT JOIN reviews r ON r.employee_id = e.id
    GROUP BY e.id
    ORDER BY e.name ASC
  `);
  return rows.map((r) => ({
    ...r,
    avg: Number(r.avg),
    best: Number(r.best),
    low: Number(r.low),
    trend: Number(r.trend),
    ready: Number(r.ready),
    consistency: Number(r.consistency),
    reviews: Number(r.reviews),
    projects: Number(r.projects),
  }));
}

async function reviewList(filters = {}) {
  const where = [];
  const params = {};
  if (filters.status && filters.status !== "All statuses") {
    where.push("r.status = :status");
    params.status = filters.status;
  }
  if (filters.employee && filters.employee !== "All employees") {
    where.push("e.name = :employee");
    params.employee = filters.employee;
  }
  if (filters.document && filters.document !== "All documents") {
    where.push("d.name = :document");
    params.document = filters.document;
  }
  if (filters.project) {
    where.push("p.name = :project");
    params.project = filters.project;
  }
  if (filters.q) {
    where.push("(e.name LIKE :q OR p.name LIKE :q OR d.name LIKE :q OR r.file_name LIKE :q)");
    params.q = `%${filters.q}%`;
  }
  const limit = Number(filters.limit || 200);
  params.limit = limit;
  const sql = `
    SELECT
      r.id, e.name AS emp, p.name AS project, d.name AS doc,
      DATE_FORMAT(r.review_date, '%b %e, %Y') AS date,
      r.review_date, ROUND(r.overall_score, 1) AS score, r.status,
      r.business_unit AS unit, r.reviewer, r.client, r.file_name, r.file_size,
      r.storage_path, r.mime_type, r.manager_notes, r.strengths, r.improvements,
      r.ai_model, r.credits_used
    FROM reviews r
    JOIN employees e ON e.id = r.employee_id
    JOIN projects p ON p.id = r.project_id
    JOIN document_types d ON d.id = r.document_type_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY r.review_date DESC, r.id DESC
    LIMIT ${limit}
  `;
  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    ...r,
    score: r.score == null ? null : Number(r.score),
    strengths: parseJsonField(r.strengths),
    improvements: parseJsonField(r.improvements),
  }));
}

async function projectStats(projectIds = null) {
  const params = {};
  let filter = "";
  if (Array.isArray(projectIds)) {
    if (!projectIds.length) return [];
    filter = `WHERE p.id IN (${projectIds.map((_, i) => `:pid${i}`).join(",")})`;
    projectIds.forEach((id, i) => { params[`pid${i}`] = id; });
  }
  const [rows] = await pool.query(
    `
    SELECT
      p.id, p.name, p.client, p.unit, p.status,
      COUNT(r.id) AS docs,
      COUNT(DISTINCT r.employee_id) AS emps,
      ROUND(COALESCE(AVG(r.overall_score), 0), 1) AS avg,
      ROUND(COALESCE(MAX(r.overall_score), 0), 1) AS best,
      ROUND(COALESCE(MIN(CASE WHEN r.overall_score IS NOT NULL THEN r.overall_score END), 0), 1) AS low,
      SUM(CASE WHEN r.status = 'Approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN r.status = 'Needs Revision' THEN 1 ELSE 0 END) AS revise,
      SUM(CASE WHEN r.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      ROUND(
        COALESCE(AVG(CASE WHEN r.review_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN r.overall_score END), 0) -
        COALESCE(AVG(CASE WHEN r.review_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN r.overall_score END), 0)
      , 1) AS trend
    FROM projects p
    LEFT JOIN reviews r ON r.project_id = p.id
    ${filter}
    GROUP BY p.id
    ORDER BY p.name ASC
  `,
    params
  );
  return rows.map((r) => {
    const docs = Number(r.docs);
    const approved = Number(r.approved);
    return {
      ...r,
      avg: Number(r.avg),
      best: Number(r.best),
      low: Number(r.low),
      trend: Number(r.trend),
      docs,
      emps: Number(r.emps),
      approved,
      revise: Number(r.revise),
      rejected: Number(r.rejected),
      pending: Number(r.pending),
      approval_rate: docs ? Math.round((approved / docs) * 100) : 0,
      consistency: docs > 1
        ? Math.max(0, Math.min(100, Math.round(100 - (Number(r.best) - Number(r.low)) * 25)))
        : docs === 1 ? 90 : 0,
    };
  });
}

async function projectDetail(idOrName) {
  const isNum = /^\d+$/.test(String(idOrName));
  const [projRows] = await pool.query(
    isNum
      ? `SELECT id, name, client, unit, status FROM projects WHERE id = :id`
      : `SELECT id, name, client, unit, status FROM projects WHERE name = :id`,
    { id: idOrName }
  );
  if (!projRows.length) return null;
  const project = projRows[0];
  const stats = (await projectStats()).find((p) => p.id === project.id);

  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(review_date, '%b') AS m, ROUND(AVG(overall_score), 2) AS score, COUNT(*) AS count
     FROM reviews WHERE project_id = :pid AND review_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
     GROUP BY YEAR(review_date), MONTH(review_date), DATE_FORMAT(review_date, '%b')
     ORDER BY YEAR(review_date), MONTH(review_date)`,
    { pid: project.id }
  );
  const [rubricBreak] = await pool.query(
    `SELECT rd.dim_key AS \`key\`, rd.description AS \`desc\`, rd.weight, ROUND(AVG(rs.score), 1) AS score
     FROM review_scores rs
     JOIN reviews r ON r.id = rs.review_id
     JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
     WHERE r.project_id = :pid AND rs.score IS NOT NULL
     GROUP BY rd.id ORDER BY rd.sort_order`,
    { pid: project.id }
  );
  const [rubricByDoc] = await pool.query(
    `SELECT d.name AS doc, COALESCE(d.short_label, d.name) AS label,
            rd.dim_key AS \`key\`, rd.sort_order, ROUND(AVG(rs.score), 1) AS score
     FROM review_scores rs
     JOIN reviews r ON r.id = rs.review_id
     JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
     JOIN document_types d ON d.id = r.document_type_id
     WHERE r.project_id = :pid AND rs.score IS NOT NULL
       AND rd.document_type_id = d.id
     GROUP BY d.id, rd.id
     ORDER BY d.id, rd.sort_order`,
    { pid: project.id }
  );
  const [docPerf] = await pool.query(
    `SELECT COALESCE(d.short_label, d.name) AS t, d.name AS full, ROUND(AVG(r.overall_score), 1) AS score, COUNT(*) AS count
     FROM reviews r JOIN document_types d ON d.id = r.document_type_id
     WHERE r.project_id = :pid GROUP BY d.id ORDER BY score DESC`,
    { pid: project.id }
  );
  const [team] = await pool.query(
    `SELECT e.name, e.initials AS init, e.unit, COUNT(r.id) AS reviews,
            ROUND(AVG(r.overall_score), 1) AS avg, ROUND(MAX(r.overall_score), 1) AS best
     FROM reviews r JOIN employees e ON e.id = r.employee_id
     WHERE r.project_id = :pid GROUP BY e.id ORDER BY avg DESC, reviews DESC`,
    { pid: project.id }
  );
  const [statusDist] = await pool.query(
    `SELECT status AS name, COUNT(*) AS value FROM reviews WHERE project_id = :pid GROUP BY status`,
    { pid: project.id }
  );
  const statusColors = {
    Approved: "#10B981",
    "Needs Revision": "#F59E0B",
    Rejected: "#EF4444",
    Pending: "#60A5FA",
  };
  const reviews = await reviewList({ project: project.name, limit: 200 });

  return {
    ...stats,
    monthly: monthly.map((m) => ({ m: m.m, score: Number(m.score), count: Number(m.count) })),
    rubric: rubricBreak.map((r) => ({
      key: r.key, desc: r.desc, weight: Number(r.weight), score: Number(r.score),
      dim: r.key.split(" ")[0], full: r.key,
    })),
    rubricByDocType: (() => {
      const map = new Map();
      for (const row of rubricByDoc) {
        if (!map.has(row.doc)) map.set(row.doc, { doc: row.doc, label: row.label, dimensions: [] });
        map.get(row.doc).dimensions.push({
          key: row.key,
          full: row.key,
          dim: row.key.split(" ")[0],
          score: Number(row.score),
        });
      }
      return [...map.values()];
    })(),
    docPerf: docPerf.map((d) => ({ t: d.t, full: d.full, score: Number(d.score), count: Number(d.count) })),
    team: team.map((t) => ({ ...t, avg: Number(t.avg), best: Number(t.best), reviews: Number(t.reviews) })),
    statusDist: statusDist.map((s) => ({
      name: s.name, value: Number(s.value), color: statusColors[s.name] || "#64748B",
    })),
    reviews,
  };
}

async function employeeDetail(idOrName) {
  const isNum = /^\d+$/.test(String(idOrName));
  const stats = await employeeStats();
  const emp = stats.find((e) => (isNum ? String(e.id) === String(idOrName) : e.name === idOrName));
  if (!emp) return null;

  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(review_date, '%b') AS m, ROUND(AVG(overall_score), 2) AS score, COUNT(*) AS count
     FROM reviews WHERE employee_id = :id AND review_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
     GROUP BY YEAR(review_date), MONTH(review_date), DATE_FORMAT(review_date, '%b')
     ORDER BY YEAR(review_date), MONTH(review_date)`,
    { id: emp.id }
  );
  const [rubric] = await pool.query(
    `SELECT rd.dim_key AS \`key\`, rd.description AS \`desc\`, rd.weight, ROUND(AVG(rs.score), 1) AS score
     FROM review_scores rs
     JOIN reviews r ON r.id = rs.review_id
     JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
     WHERE r.employee_id = :id AND rs.score IS NOT NULL
     GROUP BY rd.id ORDER BY rd.sort_order`,
    { id: emp.id }
  );
  const [rubricByDoc] = await pool.query(
    `SELECT d.name AS doc, COALESCE(d.short_label, d.name) AS label,
            rd.dim_key AS \`key\`, rd.sort_order, ROUND(AVG(rs.score), 1) AS score
     FROM review_scores rs
     JOIN reviews r ON r.id = rs.review_id
     JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
     JOIN document_types d ON d.id = r.document_type_id
     WHERE r.employee_id = :id AND rs.score IS NOT NULL
       AND rd.document_type_id = d.id
     GROUP BY d.id, rd.id
     ORDER BY d.id, rd.sort_order`,
    { id: emp.id }
  );
  const [coaching] = await pool.query(
    `SELECT id, author, note, DATE_FORMAT(created_at, '%b %e, %Y') AS date, created_at
     FROM coaching_notes WHERE employee_id = :id ORDER BY created_at DESC LIMIT 50`,
    { id: emp.id }
  );
  const history = await reviewList({ employee: emp.name, limit: 100 });

  return {
    ...emp,
    monthly: monthly.map((m) => ({ m: m.m, score: Number(m.score), count: Number(m.count) })),
    rubric: rubric.map((r) => ({
      key: r.key, desc: r.desc, weight: Number(r.weight), score: Number(r.score),
      dim: r.key.split(" ")[0], full: r.key,
    })),
    rubricByDocType: (() => {
      const map = new Map();
      for (const row of rubricByDoc) {
        if (!map.has(row.doc)) map.set(row.doc, { doc: row.doc, label: row.label, dimensions: [] });
        map.get(row.doc).dimensions.push({
          key: row.key,
          full: row.key,
          dim: row.key.split(" ")[0],
          score: Number(row.score),
        });
      }
      return [...map.values()];
    })(),
    coaching,
    history,
  };
}

async function analyticsBundle() {
  const [monthly] = await pool.query(`
    SELECT DATE_FORMAT(review_date, '%b') AS m, ROUND(AVG(overall_score), 2) AS score, COUNT(*) AS count
    FROM reviews WHERE review_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
    GROUP BY YEAR(review_date), MONTH(review_date), DATE_FORMAT(review_date, '%b')
    ORDER BY YEAR(review_date), MONTH(review_date)
  `);
  const [docPerf] = await pool.query(`
    SELECT COALESCE(d.short_label, d.name) AS t, ROUND(AVG(r.overall_score), 1) AS score
    FROM reviews r JOIN document_types d ON d.id = r.document_type_id
    GROUP BY d.id ORDER BY d.name
  `);
  const [distribution] = await pool.query(`
    SELECT
      SUM(CASE WHEN overall_score < 1 THEN 1 ELSE 0 END) AS b01,
      SUM(CASE WHEN overall_score >= 1 AND overall_score < 2 THEN 1 ELSE 0 END) AS b12,
      SUM(CASE WHEN overall_score >= 2 AND overall_score < 3 THEN 1 ELSE 0 END) AS b23,
      SUM(CASE WHEN overall_score >= 3 AND overall_score < 4 THEN 1 ELSE 0 END) AS b34,
      SUM(CASE WHEN overall_score >= 4 THEN 1 ELSE 0 END) AS b45
    FROM reviews WHERE overall_score IS NOT NULL
  `);
  const [weakAreas] = await pool.query(`
    SELECT rd.dim_key AS full,
           SUBSTRING_INDEX(rd.dim_key, ' ', 1) AS area,
           ROUND(5 - AVG(rs.score), 2) AS gap,
           ROUND(AVG(rs.score), 2) AS score
    FROM review_scores rs
    JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
    GROUP BY rd.id
    ORDER BY gap DESC
    LIMIT 8
  `);
  const [heatmapRows] = await pool.query(`
    SELECT
      CASE
        WHEN r.business_unit LIKE '%Investment%' THEN 'IB'
        WHEN r.business_unit LIKE '%Consult%' THEN 'Consulting'
        WHEN r.business_unit LIKE '%Deal%' OR r.business_unit LIKE '%Advisor%' THEN 'Advisory'
        ELSE 'Research'
      END AS unit,
      COALESCE(d.short_label, d.name) AS doc,
      ROUND(AVG(r.overall_score), 1) AS score
    FROM reviews r
    JOIN document_types d ON d.id = r.document_type_id
    GROUP BY unit, doc
  `);
  const dist = distribution[0] || {};
  return {
    monthly: monthly.map((m) => ({ m: m.m, score: Number(m.score), count: Number(m.count) })),
    docPerf: docPerf.map((d) => ({ t: d.t, score: Number(d.score) })),
    distribution: [
      { name: "0–1", value: Number(dist.b01 || 0), color: "#EF4444" },
      { name: "1–2", value: Number(dist.b12 || 0), color: "#FB7185" },
      { name: "2–3", value: Number(dist.b23 || 0), color: "#F59E0B" },
      { name: "3–4", value: Number(dist.b34 || 0), color: "#60A5FA" },
      { name: "4–5", value: Number(dist.b45 || 0), color: "#10B981" },
    ],
    weakAreas: weakAreas.map((w) => ({
      area: w.area, full: w.full, gap: Number(w.gap), score: Number(w.score),
    })),
    heatmap: heatmapRows.map((h) => ({ unit: h.unit, doc: h.doc, score: Number(h.score) })),
  };
}

async function dashboardKpis() {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM reviews`);
  const [[{ pending }]] = await pool.query(`SELECT COUNT(*) AS pending FROM reviews WHERE status = 'Pending'`);
  const [[{ avg }]] = await pool.query(`SELECT ROUND(AVG(overall_score), 2) AS avg FROM reviews WHERE overall_score IS NOT NULL`);
  const [[{ projects }]] = await pool.query(`SELECT COUNT(DISTINCT project_id) AS projects FROM reviews`);
  const [[{ employees }]] = await pool.query(`SELECT COUNT(DISTINCT employee_id) AS employees FROM reviews`);
  const [[{ turnaround }]] = await pool.query(`
    SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, submitted_at, completed_at)) / 24, 1) AS turnaround
    FROM reviews WHERE submitted_at IS NOT NULL AND completed_at IS NOT NULL
  `);
  const [[{ prevTotal }]] = await pool.query(`
    SELECT COUNT(*) AS prevTotal FROM reviews
    WHERE review_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
      AND review_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);
  const [[{ currTotal }]] = await pool.query(`
    SELECT COUNT(*) AS currTotal FROM reviews
    WHERE review_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
  `);
  const [sparkRows] = await pool.query(`
    SELECT DATE_FORMAT(review_date, '%b') AS m, COUNT(*) AS c, ROUND(AVG(overall_score), 2) AS score
    FROM reviews WHERE review_date >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
    GROUP BY YEAR(review_date), MONTH(review_date), DATE_FORMAT(review_date, '%b')
    ORDER BY YEAR(review_date), MONTH(review_date)
  `);
  const mom = prevTotal ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : (currTotal ? 100 : 0);
  const used = Number(await getSetting("ai_credits_used", "0"));
  const totalCredits = Number(await getSetting("ai_credits_total", "2000"));

  return {
    totalReviews: Number(total),
    pending: Number(pending),
    avgScore: Number(avg || 0),
    projects: Number(projects),
    employees: Number(employees),
    turnaroundDays: Number(turnaround || 5.4),
    reviewsMomPct: mom,
    creditsUsed: used,
    creditsTotal: totalCredits,
    sparkline: sparkRows.map((r) => ({ m: r.m, count: Number(r.c), score: Number(r.score) })),
    reviewerName: await getSetting("reviewer_name", "Dhritiman Mitra"),
    reviewerRole: await getSetting("reviewer_role", "Engagement Manager"),
  };
}

/* ============================ ROUTES ============================ */

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: process.env.MYSQL_DATABASE });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/auth/config", (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID?.trim()),
  });
});

app.get("/api/auth/directory", async (_req, res) => {
  try {
    res.json({ users: await listDirectory() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    // Legacy demo picker: { userId }
    if (req.body?.userId != null && req.body?.email == null) {
      const userId = Number(req.body.userId);
      if (!userId) return res.status(400).json({ error: "userId required" });
      const u = await findUserById(userId);
      if (!u) return res.status(404).json({ error: "User not found" });
      const session = await createSession(u.id);
      return res.json({
        token: session.token,
        expiresAt: session.expiresAt,
        user: formatUserRow(u),
      });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const u = await findUserByEmail(email);
    if (!u) return res.status(401).json({ error: "Invalid email or password" });

    const hash = await getUserPasswordHash(u.id);
    const ok = await verifyPassword(password, hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const session = await createSession(u.id);
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: formatUserRow(u),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(503).json({ error: "Google sign-in is not configured" });
    }
    const credential = String(req.body?.credential || "").trim();
    if (!credential) return res.status(400).json({ error: "Google credential required" });

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: "Google account email not available" });
    }
    if (payload.email_verified === false) {
      return res.status(401).json({ error: "Google email is not verified" });
    }

    const email = String(payload.email).trim().toLowerCase();
    const sub = payload.sub;
    const displayName = String(payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ") || "").trim();

    const u = await resolveGoogleUser({ email, sub, displayName });
    if (!u) {
      return res.status(401).json({ error: "Could not map Google account to an EverGauge user" });
    }
    console.log(`[auth/google] ${email} → ${u.display_name} (${u.role})${u.employee_id ? ` · employee #${u.employee_id}` : ""}`);

    const session = await createSession(u.id);
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: formatUserRow(u),
    });
  } catch (err) {
    console.error("[auth/google]", err.message);
    res.status(401).json({ error: err.message || "Google sign-in failed" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    await destroySession(req.token);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bootstrap", async (req, res) => {
  try {
    const isAdmin = req.user?.isAdmin;
    const employeeId = req.user?.employeeId;

    const [docTypes] = await pool.query(
      `SELECT id, name, short_label, sla_days, sla_note FROM document_types
       ORDER BY FIELD(name, ${DOC_TYPE_NAMES.map(() => "?").join(",")})`,
      DOC_TYPE_NAMES
    );

    if (!isAdmin) {
      if (!employeeId) {
        return res.status(403).json({ error: "Employee account is not linked to an employee record" });
      }
      const memberIds = await getMemberProjectIds(employeeId);
      const allEmployees = await employeeStats();
      const me = allEmployees.find((e) => e.id === employeeId) || null;
      const projects = await projectStats(memberIds);
      const reviews = await reviewList({ employee: req.user.employeeName, limit: 100 });
      const detail = await employeeDetail(employeeId);

      return res.json({
        view: "employee",
        user: req.user,
        employees: me ? [me] : [],
        projects,
        reviews,
        rubric: [],
        rubricsByDocType: [],
        docTypes: docTypes.map((d) => d.name),
        docTypeMeta: docTypes.map((d) => ({
          id: d.id,
          name: d.name,
          short_label: d.short_label,
          sla_days: d.sla_days,
          sla_note: d.sla_note,
        })),
        audit: [],
        analytics: { monthly: detail?.monthly || [], docPerf: [], distribution: [], weakAreas: [], heatmap: [] },
        kpis: me
          ? {
              totalReviews: me.reviews,
              pending: reviews.filter((r) => r.status === "Pending").length,
              avgScore: me.avg,
              projects: me.projects,
              employees: 1,
              turnaroundDays: 0,
              reviewsMomPct: 0,
              creditsUsed: 0,
              creditsTotal: 0,
              sparkline: (detail?.monthly || []).map((m) => ({ m: m.m, count: m.count || 0, score: m.score })),
              reviewerName: req.user.displayName,
              reviewerRole: "Employee",
            }
          : null,
        me: detail,
        notifications: [],
      });
    }

    const [rubric] = await pool.query(
      `SELECT id, document_type_id, dim_key AS \`key\`, description AS \`desc\`, weight, enabled AS \`on\`,
              is_manual, guide_1, guide_2, guide_3, guide_4, guide_5
       FROM rubric_dimensions WHERE enabled = 1 ORDER BY sort_order`
    );
    const rubricsByDocType = await loadRubricsByDocType();
    const [audit] = await pool.query(
      `SELECT id, actor AS who, action AS what,
              CASE
                WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 'today'
                WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN CONCAT(TIMESTAMPDIFF(DAY, created_at, NOW()), ' days ago')
                WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN CONCAT(TIMESTAMPDIFF(WEEK, created_at, NOW()), ' weeks ago')
                ELSE DATE_FORMAT(created_at, '%b %e, %Y')
              END AS \`when\`
       FROM rubric_audit ORDER BY created_at DESC LIMIT 20`
    );
    const [notifications] = await pool.query(
      `SELECT id, title, body, is_read AS \`read\`, DATE_FORMAT(created_at, '%b %e, %Y %H:%i') AS date
       FROM notifications ORDER BY created_at DESC LIMIT 20`
    );
    const employees = await employeeStats();
    const reviews = await reviewList({ limit: 200 });
    const projects = await projectStats();
    const analytics = await analyticsBundle();
    const kpis = await dashboardKpis();

    res.json({
      view: "admin",
      user: req.user,
      employees,
      projects,
      reviews,
      rubric: rubric.map((r) => ({
        id: r.id,
        document_type_id: r.document_type_id,
        key: r.key,
        desc: r.desc,
        weight: Number(r.weight),
        on: Boolean(r.on),
        is_manual: Boolean(r.is_manual),
        guides: [r.guide_1, r.guide_2, r.guide_3, r.guide_4, r.guide_5].filter(Boolean),
      })),
      rubricsByDocType,
      docTypes: docTypes.map((d) => d.name),
      docTypeMeta: docTypes.map((d) => ({
        id: d.id,
        name: d.name,
        short_label: d.short_label,
        sla_days: d.sla_days,
        sla_note: d.sla_note,
      })),
      audit,
      analytics,
      kpis,
      me: null,
      notifications: notifications.map((n) => ({ ...n, read: Boolean(n.read) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard/kpis", async (req, res) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
    res.json(await dashboardKpis());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/employees", requireAdmin, async (_req, res) => {
  try { res.json(await employeeStats()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/employees/:id", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    if (!req.user?.isAdmin) {
      const selfId = String(req.user?.employeeId || "");
      const selfName = req.user?.employeeName || "";
      if (String(id) !== selfId && id !== selfName) {
        return res.status(403).json({ error: "You can only view your own profile" });
      }
    }
    const detail = await employeeDetail(id);
    if (!detail) return res.status(404).json({ error: "Employee not found" });
    res.json(detail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees", requireAdmin, async (req, res) => {
  try {
    const { name, unit } = req.body;
    if (!name || !unit) return res.status(400).json({ error: "name and unit required" });
    const [result] = await pool.query(
      `INSERT INTO employees (name, unit, initials) VALUES (:name, :unit, :initials)`,
      { name, unit, initials: initials(name) }
    );
    res.status(201).json({ id: result.insertId, name, unit, init: initials(name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/employees/:id/coaching", requireAdmin, async (req, res) => {
  try {
    const detail = await employeeDetail(decodeURIComponent(req.params.id));
    if (!detail) return res.status(404).json({ error: "Employee not found" });
    res.json(detail.coaching);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/employees/:id/coaching", requireAdmin, async (req, res) => {
  try {
    const detail = await employeeDetail(decodeURIComponent(req.params.id));
    if (!detail) return res.status(404).json({ error: "Employee not found" });
    const note = (req.body.note || "").trim();
    if (!note) return res.status(400).json({ error: "note required" });
    const author = req.body.author || (await getSetting("reviewer_name", "Dhritiman Mitra"));
    const [result] = await pool.query(
      `INSERT INTO coaching_notes (employee_id, author, note) VALUES (:employee_id, :author, :note)`,
      { employee_id: detail.id, author, note }
    );
    res.status(201).json({ id: result.insertId, author, note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    if (req.user?.isAdmin) return res.json(await projectStats());
    const ids = await getMemberProjectIds(req.user?.employeeId);
    res.json(await projectStats(ids));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/projects", requireAdmin, async (req, res) => {
  try {
    const { name, unit, client = "Confidential" } = req.body;
    if (!name || !unit) return res.status(400).json({ error: "name and unit required" });
    const id = await getOrCreateProject(name, unit, client);
    res.status(201).json({ id, name, unit, client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    if (!req.user?.isAdmin) {
      const ok = await isProjectMember(req.user?.employeeId, id);
      if (!ok) return res.status(403).json({ error: "You are not assigned to this project" });
    }
    const detail = await projectDetail(id);
    if (!detail) return res.status(404).json({ error: "Project not found" });
    res.json(detail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reviews", async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.json(await reviewList({ employee: req.user?.employeeName, limit: Number(req.query.limit || 100) }));
    }
    res.json(await reviewList({
      status: req.query.status,
      employee: req.query.employee,
      document: req.query.document,
      project: req.query.project,
      q: req.query.q,
      limit: req.query.limit,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reviews/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.employee_id, r.project_id, r.document_type_id, r.reviewer, r.business_unit, r.client,
              r.file_name, r.file_size, r.storage_path, r.mime_type, r.file_bytes,
              DATE_FORMAT(r.review_date, '%b %e, %Y') AS review_date,
              r.review_date AS review_date_raw,
              r.overall_score, r.status, r.manager_notes, r.strengths, r.improvements,
              r.ai_model, r.credits_used, r.submitted_at, r.completed_at,
              e.name AS emp, p.name AS project, d.name AS doc
       FROM reviews r
       JOIN employees e ON e.id = r.employee_id
       JOIN projects p ON p.id = r.project_id
       JOIN document_types d ON d.id = r.document_type_id
       WHERE r.id = :id`,
      { id: req.params.id }
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    if (!req.user?.isAdmin) {
      const own = rows[0].emp === req.user?.employeeName;
      const onProject = await isProjectMember(req.user?.employeeId, rows[0].project);
      if (!own && !onProject) {
        return res.status(403).json({ error: "You can only view reviews on your assigned projects" });
      }
    }
    const [scores] = await pool.query(
      `SELECT rd.dim_key AS \`key\`, rd.description AS \`desc\`, rd.weight, rd.is_manual,
              rd.guide_1, rd.guide_2, rd.guide_3, rd.guide_4, rd.guide_5,
              rs.score, rs.ai_note, rs.manager_note
       FROM review_scores rs
       JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
       WHERE rs.review_id = :id ORDER BY rd.sort_order`,
      { id: req.params.id }
    );
    const review = rows[0];
    const scoreRows = scores.map((s) => ({
      key: s.key,
      desc: s.desc,
      weight: Number(s.weight),
      is_manual: Boolean(s.is_manual),
      guides: [s.guide_1, s.guide_2, s.guide_3, s.guide_4, s.guide_5].filter(Boolean),
      score: s.score == null ? null : Number(s.score),
      ai_note: s.ai_note,
      manager_note: s.manager_note,
    }));
    const scoreMap = Object.fromEntries(scoreRows.map((s) => [s.key, s.score]));
    const noteMap = Object.fromEntries(scoreRows.map((s) => [s.key, s.ai_note]));
    const derived = buildInsightsFromScores(
      scoreRows.map((s) => ({ dim_key: s.key, is_manual: s.is_manual })),
      scoreMap,
      noteMap
    );
    // Prefer score-derived insights so lists stay logical even for older stub bank text
    const strengths = derived.strengths.length ? derived.strengths : parseJsonField(review.strengths);
    const improvements = derived.improvements.length ? derived.improvements : parseJsonField(review.improvements);
    res.json({
      ...review,
      overall_score: review.overall_score == null ? null : Number(review.overall_score),
      strengths,
      improvements,
      scores: scoreRows,
      pendingManual: scores.filter((s) => s.is_manual && s.score == null).map((s) => s.key),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reviews", requireAdmin, upload.single("file"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const body = req.body || {};
    const employee = body.employee;
    const project = body.project;
    const documentType = body.documentType;
    const reviewDate = body.reviewDate || new Date().toISOString().slice(0, 10);
    const reviewer = body.reviewer || (await getSetting("reviewer_name", "Dhritiman Mitra"));
    const businessUnit = body.businessUnit;
    const client = body.client || null;
    const status = body.status || "Pending";

    if (!employee || !project || !documentType) {
      return res.status(400).json({ error: "employee, project, documentType required" });
    }

    const [emps] = await conn.query("SELECT id, unit FROM employees WHERE name = :name", { name: employee });
    if (!emps.length) return res.status(400).json({ error: "Unknown employee" });

    const employeeId = emps[0].id;
    const unit = businessUnit || emps[0].unit;
    const projectId = await getOrCreateProject(project, unit, client || "Confidential");
    const docTypeId = await getOrCreateDocType(documentType);

    const [dims] = await conn.query(
      `SELECT id, dim_key, weight, is_manual, guide_1, guide_2, guide_3, guide_4, guide_5
       FROM rubric_dimensions WHERE document_type_id = :doc AND enabled = 1 ORDER BY sort_order`,
      { doc: docTypeId }
    );

    const fileName = req.file?.originalname || body.fileName || `${project.replace(/\s+/g, "_")}.pdf`;
    const fileBytes = req.file?.size ?? (body.fileBytes ? Number(body.fileBytes) : null);
    const fileSize = formatBytes(fileBytes) || body.fileSize || null;
    const storagePath = req.file ? `/uploads/${req.file.filename}` : null;
    const mimeType = req.file?.mimetype || body.mimeType || null;
    const requireAi = String(body.requireAi || "").toLowerCase() === "true"
      || String(process.env.REQUIRE_ANTHROPIC || "").toLowerCase() === "true";

    const assessment = await runAssessment(
      {
        dimensions: dims.map((d) => ({ ...d, is_manual: Boolean(d.is_manual) })),
        fileName,
        filePath: req.file?.path || null,
        mimeType,
        project,
        documentType,
        employee,
      },
      { requireAi }
    );

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO reviews
        (employee_id, project_id, document_type_id, reviewer, business_unit, client,
         file_name, file_size, storage_path, mime_type, file_bytes, review_date,
         overall_score, status, manager_notes, strengths, improvements,
         ai_model, credits_used, submitted_at, completed_at)
       VALUES
        (:employee_id, :project_id, :document_type_id, :reviewer, :business_unit, :client,
         :file_name, :file_size, :storage_path, :mime_type, :file_bytes, :review_date,
         :overall_score, :status, :manager_notes, :strengths, :improvements,
         :ai_model, :credits_used, NOW(), NOW())`,
      {
        employee_id: employeeId,
        project_id: projectId,
        document_type_id: docTypeId,
        reviewer,
        business_unit: unit,
        client,
        file_name: fileName,
        file_size: fileSize,
        storage_path: storagePath,
        mime_type: mimeType,
        file_bytes: fileBytes,
        review_date: reviewDate,
        overall_score: assessment.overall,
        status,
        manager_notes: body.managerNotes || null,
        strengths: JSON.stringify(assessment.strengths),
        improvements: JSON.stringify(assessment.improvements),
        ai_model: String(assessment.aiModel || "").slice(0, 80) || null,
        credits_used: assessment.creditsUsed,
      }
    );

    const reviewId = result.insertId;
    for (const d of dims) {
      await conn.query(
        `INSERT INTO review_scores (review_id, dimension_id, score, ai_note)
         VALUES (:review_id, :dimension_id, :score, :ai_note)`,
        {
          review_id: reviewId,
          dimension_id: d.id,
          score: assessment.scores[d.dim_key],
          ai_note: assessment.aiNotes[d.dim_key],
        }
      );
    }

    await conn.query(
      `INSERT IGNORE INTO project_members (project_id, employee_id) VALUES (:project_id, :employee_id)`,
      { project_id: projectId, employee_id: employeeId }
    );
    await conn.commit();

    await bumpCredits(assessment.creditsUsed);
    await addNotification(
      `Assessment ready · ${project}`,
      `${employee} · ${documentType} scored ${assessment.overall}/5`
    );

    const [created] = await pool.query(
      `SELECT r.id, e.name AS emp, p.name AS project, d.name AS doc,
              DATE_FORMAT(r.review_date, '%b %e, %Y') AS date,
              ROUND(r.overall_score, 1) AS score, r.status, r.storage_path, r.ai_model
       FROM reviews r
       JOIN employees e ON e.id = r.employee_id
       JOIN projects p ON p.id = r.project_id
       JOIN document_types d ON d.id = r.document_type_id
       WHERE r.id = :id`,
      { id: reviewId }
    );

    res.status(201).json({
      ...created[0],
      score: Number(created[0].score),
      id: reviewId,
      overall: assessment.overall,
      strengths: assessment.strengths,
      improvements: assessment.improvements,
      aiModel: assessment.aiModel,
      usedStub: Boolean(assessment.usedStub),
    });
  } catch (err) {
    try { await conn.rollback(); } catch { /* no open txn */ }
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.patch("/api/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const {
      status, managerNotes, managerScoreNotes, scores,
      employee, project, documentType, reviewDate, businessUnit, client,
    } = req.body;
    const [existing] = await pool.query(`SELECT status FROM reviews WHERE id = :id`, { id: req.params.id });
    if (!existing.length) return res.status(404).json({ error: "Not found" });
    const currentStatus = existing[0].status || "Pending";
    const decided = currentStatus !== "Pending";
    if (decided && status) {
      return res.status(409).json({
        error: `This review is already marked ${currentStatus}. Decision cannot be changed.`,
      });
    }
    const fields = [];
    const params = { id: req.params.id };
    if (status) {
      fields.push("status = :status");
      params.status = status;
      if (status !== "Pending") fields.push("completed_at = COALESCE(completed_at, NOW())");
    }
    if (managerNotes !== undefined) {
      fields.push("manager_notes = :manager_notes");
      params.manager_notes = managerNotes;
    }
    if (employee) {
      const [emps] = await pool.query("SELECT id, unit FROM employees WHERE name = :name", { name: employee });
      if (!emps.length) return res.status(400).json({ error: "Unknown employee" });
      fields.push("employee_id = :employee_id");
      params.employee_id = emps[0].id;
      if (!businessUnit) {
        fields.push("business_unit = COALESCE(business_unit, :bu_fallback)");
        params.bu_fallback = emps[0].unit;
      }
    }
    if (project) {
      const [unitRows] = await pool.query(`SELECT business_unit FROM reviews WHERE id = :id`, { id: req.params.id });
      const unit = businessUnit || unitRows[0]?.business_unit || "Capital";
      const projectId = await getOrCreateProject(project, unit, client || "Confidential");
      fields.push("project_id = :project_id");
      params.project_id = projectId;
    }
    if (documentType) {
      const docTypeId = await getOrCreateDocType(documentType);
      fields.push("document_type_id = :document_type_id");
      params.document_type_id = docTypeId;
    }
    if (reviewDate) {
      fields.push("review_date = :review_date");
      params.review_date = reviewDate;
    }
    if (businessUnit) {
      fields.push("business_unit = :business_unit");
      params.business_unit = businessUnit;
    }
    if (client !== undefined) {
      fields.push("client = :client");
      params.client = client;
    }
    if (fields.length) {
      await pool.query(`UPDATE reviews SET ${fields.join(", ")} WHERE id = :id`, params);
    }
    if (managerScoreNotes && typeof managerScoreNotes === "object") {
      for (const [key, note] of Object.entries(managerScoreNotes)) {
        await pool.query(
          `UPDATE review_scores rs
           JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
           SET rs.manager_note = :note
           WHERE rs.review_id = :id AND rd.dim_key = :key`,
          { id: req.params.id, key, note }
        );
      }
    }
    let overall = undefined;
    if (scores && typeof scores === "object") {
      for (const [key, score] of Object.entries(scores)) {
        const n = score === null || score === "" ? null : Math.round(Number(score) * 10) / 10;
        if (n != null && (n < 1 || n > 5)) continue;
        await pool.query(
          `UPDATE review_scores rs
           JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
           SET rs.score = :score
           WHERE rs.review_id = :id AND rd.dim_key = :key`,
          { id: req.params.id, key, score: n }
        );
      }
      const [allScores] = await pool.query(
        `SELECT score FROM review_scores WHERE review_id = :id`,
        { id: req.params.id }
      );
      overall = averageScores(allScores.map((s) => s.score));
      await pool.query(
        `UPDATE reviews SET overall_score = :overall WHERE id = :id`,
        { id: req.params.id, overall }
      );
    }
    if (status) {
      await addNotification(`Review ${status}`, `Review #${req.params.id} marked ${status}`);
    }
    const payload = { ok: true };
    if (overall !== undefined) payload.overall_score = overall;
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function escapePdfText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildScorecardPdfBuffer({ title, metaLines, scoreLines, footer }) {
  const lines = [
    title,
    "",
    ...metaLines,
    "",
    "Dimension scores",
    "----------------",
    ...scoreLines,
    "",
    footer || "",
  ];
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 800 Td",
    "14 TL",
    ...lines.map((line, i) => (i === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`)),
    "ET",
  ].join("\n");

  const objects = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n"
  );
  objects.push(`4 0 obj<< /Length ${Buffer.byteLength(content, "utf8")} >>stream\n${content}\nendstream\nendobj\n`);
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

app.delete("/api/reviews/:id", requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(`SELECT id, storage_path FROM reviews WHERE id = :id`, { id: req.params.id });
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: "Not found" });
    }
    await conn.query(`DELETE FROM review_scores WHERE review_id = :id`, { id: req.params.id });
    await conn.query(`DELETE FROM reviews WHERE id = :id`, { id: req.params.id });
    await conn.commit();
    const storagePath = existing[0].storage_path;
    if (storagePath) {
      const full = path.isAbsolute(storagePath) ? storagePath : path.join(uploadsDir, path.basename(storagePath));
      fs.promises.unlink(full).catch(() => {});
    }
    await addNotification("Review deleted", `Review #${req.params.id} was removed`);
    res.json({ ok: true });
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get("/api/reviews/:id/scorecard.pdf", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.overall_score, r.status, r.reviewer, r.business_unit, r.client, r.file_name,
              DATE_FORMAT(r.review_date, '%b %e, %Y') AS review_date,
              e.name AS emp, p.name AS project, d.name AS doc
       FROM reviews r
       JOIN employees e ON e.id = r.employee_id
       JOIN projects p ON p.id = r.project_id
       JOIN document_types d ON d.id = r.document_type_id
       WHERE r.id = :id`,
      { id: req.params.id }
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const review = rows[0];
    if (!req.user?.isAdmin) {
      const own = review.emp === req.user?.employeeName;
      const onProject = await isProjectMember(req.user?.employeeId, review.project);
      if (!own && !onProject) {
        return res.status(403).json({ error: "You can only download scorecards for your assigned projects" });
      }
    }
    const [scores] = await pool.query(
      `SELECT rd.dim_key AS \`key\`, rd.weight, rs.score
       FROM review_scores rs
       JOIN rubric_dimensions rd ON rd.id = rs.dimension_id
       WHERE rs.review_id = :id
       ORDER BY rd.sort_order`,
      { id: req.params.id }
    );
    const overall = review.overall_score == null ? "—" : Number(review.overall_score).toFixed(2);
    const pdf = buildScorecardPdfBuffer({
      title: "EverGauge Scorecard",
      metaLines: [
        `Employee: ${review.emp}`,
        `Project: ${review.project}`,
        `Document: ${review.doc}`,
        `Date: ${review.review_date}`,
        `Reviewer: ${review.reviewer || "—"}`,
        `Unit: ${review.business_unit || "—"}`,
        `Status: ${review.status}`,
        `Overall: ${overall} / 5`,
        `File: ${review.file_name || "—"}`,
      ],
      scoreLines: scores.length
        ? scores.map((s) => {
          const sc = s.score == null ? "—" : Number(s.score).toFixed(1);
          return `${s.key}: ${sc}/5  (weight ${Number(s.weight)}%)`;
        })
        : ["No dimension scores recorded."],
      footer: `Generated ${new Date().toISOString().slice(0, 10)}`,
    });
    const safeName = String(review.project || "scorecard").replace(/[^\w\-]+/g, "_").slice(0, 40);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="scorecard-${safeName}-${review.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/rubric", async (_req, res) => {
  try {
    res.json(await loadRubricsByDocType());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/rubric", requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { docType, rows, actor = "Admin" } = req.body;
    if (!docType || !Array.isArray(rows)) {
      return res.status(400).json({ error: "docType and rows required" });
    }
    const [docs] = await conn.query(`SELECT id FROM document_types WHERE name = :name`, { name: docType });
    if (!docs.length) return res.status(404).json({ error: "Unknown document type" });
    const docId = docs[0].id;

    await conn.beginTransaction();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const guides = Array.isArray(r.guides) ? r.guides : [];
      const level5 = r.desc != null && r.desc !== "" ? r.desc : (guides[4] || null);
      await conn.query(
        `UPDATE rubric_dimensions
         SET description = :description,
             guide_5 = :guide_5,
             weight = :weight,
             enabled = :enabled,
             sort_order = :sort_order
         WHERE document_type_id = :doc AND dim_key = :dim_key`,
        {
          doc: docId,
          dim_key: r.key,
          description: level5 || r.key,
          guide_5: level5,
          weight: r.weight,
          enabled: r.on === false ? 0 : 1,
          sort_order: i + 1,
        }
      );
    }
    await conn.query(
      `INSERT INTO rubric_audit (actor, action) VALUES (:actor, :action)`,
      { actor, action: `published ${docType} rubric update (${rows.length} dimensions)` }
    );
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

app.get("/api/analytics", requireAdmin, async (_req, res) => {
  try { res.json(await analyticsBundle()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/notifications", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, body, is_read AS \`read\`, DATE_FORMAT(created_at, '%b %e, %Y %H:%i') AS date
       FROM notifications ORDER BY created_at DESC LIMIT 30`
    );
    res.json(rows.map((n) => ({ ...n, read: Boolean(n.read) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notifications/read-all", async (_req, res) => {
  try {
    await pool.query(`UPDATE notifications SET is_read = 1 WHERE is_read = 0`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ employees: [], projects: [], reviews: [] });
    const like = `%${q}%`;
    const [employees] = await pool.query(
      `SELECT id, name, unit, initials AS init FROM employees WHERE name LIKE :like OR unit LIKE :like LIMIT 10`,
      { like }
    );
    const [projects] = await pool.query(
      `SELECT id, name, unit, client FROM projects WHERE name LIKE :like OR client LIKE :like OR unit LIKE :like LIMIT 10`,
      { like }
    );
    const reviews = await reviewList({ q, limit: 10 });
    res.json({ employees, projects, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/:type", requireAdmin, async (req, res) => {
  try {
    const type = req.params.type;
    const employees = await employeeStats();
    const projects = await projectStats();
    const reviews = await reviewList({ limit: 500 });
    const analytics = await analyticsBundle();
    const kpis = await dashboardKpis();

    let payload;
    switch (type) {
      case "quarterly":
        payload = { type, generatedAt: new Date().toISOString(), kpis, analytics, reviewCount: reviews.length };
        break;
      case "employees":
        payload = { type, generatedAt: new Date().toISOString(), employees };
        break;
      case "projects":
        payload = { type, generatedAt: new Date().toISOString(), projects, reviews };
        break;
      case "compliance":
        payload = {
          type,
          generatedAt: new Date().toISOString(),
          anonymityFlags: reviews.filter((r) => (r.improvements || []).some((i) => /anonym|redact/i.test(i))),
          rejected: reviews.filter((r) => r.status === "Rejected"),
          needsRevision: reviews.filter((r) => r.status === "Needs Revision"),
        };
        break;
      default:
        return res.status(404).json({ error: "Unknown report type" });
    }

    if (req.query.format === "csv" && type === "employees") {
      const header = "name,unit,avg,reviews,projects,best,low,trend,ready,consistency\n";
      const lines = employees.map((e) =>
        [e.name, e.unit, e.avg, e.reviews, e.projects, e.best, e.low, e.trend, e.ready, e.consistency]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
      return res.send(header + lines);
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 3001);

async function start() {
  await assertPortFree(port);
  await initSchema();
  const synced = await syncEvernileRubrics(false);
  const seeded = await seedIfEmpty();
  const roster = await ensureCoreEmployees();
  const authCreds = await seedAuthCredentials();
  const ima = await seedImaAccess();

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    if (synced) console.log("Evernile rubrics synced (Teaser / IM-CIM / Financial Model).");
    console.log(seeded ? "Database seeded with initial data." : "Demo project/review seed skipped.");
    console.log(`Employees ready · ${roster.total} people`);
    console.log(`IMA ready · ${ima.users} users · ${ima.members} project memberships`);
    if (authCreds.adminsUpserted) {
      console.log(`Auth admins ready · ${authCreds.adminsUpserted} · password hashed (scrypt)`);
    }
    if (roster.removed) console.log(`Removed ${roster.removed} retired employee(s) from roster`);
    if (process.env.GOOGLE_CLIENT_ID?.trim()) {
      console.log("Google sign-in enabled");
    } else {
      console.log("Google sign-in disabled · set GOOGLE_CLIENT_ID in .env to enable");
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the other API process, then run: npm run dev`);
    } else {
      console.error("API server error:", err);
    }
    process.exit(1);
  });
}

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
