import crypto from "crypto";
import pool from "./db.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function publicAuthPaths(path) {
  return (
    path === "/api/health" ||
    path === "/api/auth/directory" ||
    path === "/api/auth/login" ||
    path === "/api/auth/google" ||
    path === "/api/auth/config" ||
    path.startsWith("/uploads/")
  );
}

export function formatUserRow(u) {
  return {
    id: u.id,
    loginKey: u.login_key,
    email: u.email || null,
    displayName: u.display_name,
    role: u.role,
    employeeId: u.employee_id,
    externalId: u.external_id,
    employeeName: u.employee_name,
    employeeUnit: u.employee_unit,
    employeeInit: u.employee_init,
    isAdmin: u.role === "admin",
    isEmployee: u.role === "employee",
  };
}

const USER_SELECT = `SELECT u.id, u.login_key, u.email, u.google_sub, u.display_name, u.role, u.employee_id, u.external_id, u.is_active,
            e.name AS employee_name, e.unit AS employee_unit, e.initials AS employee_init
     FROM app_users u
     LEFT JOIN employees e ON e.id = u.employee_id`;

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE LOWER(u.email) = LOWER(:email) AND u.is_active = 1
     LIMIT 1`,
    { email: String(email || "").trim() }
  );
  return rows[0] || null;
}

export async function findUserByGoogleSub(sub) {
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE u.google_sub = :sub AND u.is_active = 1
     LIMIT 1`,
    { sub }
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE u.id = :id AND u.is_active = 1
     LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

export async function getUserPasswordHash(userId) {
  const [rows] = await pool.query(
    `SELECT password_hash FROM app_users WHERE id = :id LIMIT 1`,
    { id: userId }
  );
  return rows[0]?.password_hash || null;
}

export async function linkGoogleSub(userId, sub) {
  await pool.query(`UPDATE app_users SET google_sub = :sub WHERE id = :id`, { id: userId, sub });
}

function slugifyLoginKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60);
}

function normalizePersonName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match Google profile name to an employees row (exact normalized, then fuzzy). */
export async function findEmployeeByGoogleName(googleName) {
  const target = normalizePersonName(googleName);
  if (!target) return null;

  const [rows] = await pool.query(`SELECT id, name, unit, initials FROM employees`);
  const exact = rows.find((r) => normalizePersonName(r.name) === target);
  if (exact) return exact;

  // Fallback: all tokens from Google name appear in employee name (order-independent)
  const tokens = target.split(" ").filter((t) => t.length > 1);
  if (tokens.length < 2) return null;
  const fuzzy = rows.find((r) => {
    const n = normalizePersonName(r.name);
    return tokens.every((t) => n.includes(t));
  });
  return fuzzy || null;
}

export async function findUserByDisplayName(googleName) {
  const target = normalizePersonName(googleName);
  if (!target) return null;
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE u.is_active = 1`
  );
  return rows.find((r) => normalizePersonName(r.display_name) === target) || null;
}

/**
 * Sync Google profile onto an existing app_users row:
 * - display_name from Google
 * - email / google_sub
 * - employee_id from Google name → employees.name
 * - role from admin email allowlist
 */
export async function syncUserFromGoogleProfile(userId, { email, sub, displayName, employeeId, role }) {
  if (employeeId) {
    await pool.query(
      `UPDATE app_users SET employee_id = NULL WHERE employee_id = :employee_id AND id <> :id`,
      { employee_id: employeeId, id: userId }
    );
  }
  await pool.query(
    `UPDATE app_users
     SET display_name = COALESCE(:display_name, display_name),
         email = COALESCE(:email, email),
         google_sub = COALESCE(:google_sub, google_sub),
         employee_id = COALESCE(:employee_id, employee_id),
         role = COALESCE(:role, role),
         is_active = 1
     WHERE id = :id`,
    {
      id: userId,
      display_name: displayName || null,
      email: email ? String(email).trim().toLowerCase() : null,
      google_sub: sub || null,
      employee_id: employeeId ?? null,
      role: role || null,
    }
  );
  // If employeeId explicitly null and we want to set it only when provided — COALESCE keeps old.
  // When we have a resolved employeeId, force it:
  if (employeeId != null) {
    await pool.query(`UPDATE app_users SET employee_id = :employee_id WHERE id = :id`, {
      id: userId,
      employee_id: employeeId,
    });
  }
  if (role) {
    await pool.query(`UPDATE app_users SET role = :role WHERE id = :id`, { id: userId, role });
  }
  return findUserById(userId);
}

/**
 * Resolve or create app user from Google identity, mapping by Google account name to DB.
 */
export async function resolveGoogleUser({ email, sub, displayName }) {
  const { isAdminEmail } = await import("./schema.js");
  const name = String(displayName || "").trim() || email.split("@")[0];
  const role = isAdminEmail(email) ? "admin" : "employee";
  const employee = await findEmployeeByGoogleName(name);

  let u = sub ? await findUserByGoogleSub(sub) : null;
  if (!u) u = await findUserByEmail(email);
  if (!u && name) u = await findUserByDisplayName(name);
  // Prefer the app_user already linked to the matched employee
  if (!u && employee) {
    const [linked] = await pool.query(
      `${USER_SELECT} WHERE u.employee_id = :eid AND u.is_active = 1 LIMIT 1`,
      { eid: employee.id }
    );
    if (linked.length) u = linked[0];
  }

  if (u) {
    return syncUserFromGoogleProfile(u.id, {
      email,
      sub,
      displayName: name,
      employeeId: employee?.id ?? u.employee_id ?? null,
      role,
    });
  }

  return provisionGoogleUser({
    email,
    sub,
    displayName: name,
    employeeId: employee?.id || null,
    role,
  });
}

/**
 * Create an app user for a verified Google identity.
 * Prefer linking employee via Google account name.
 */
export async function provisionGoogleUser({ email, sub, displayName, employeeId = null, role = null }) {
  const { isAdminEmail } = await import("./schema.js");
  const resolvedRole = role || (isAdminEmail(email) ? "admin" : "employee");
  const name = String(displayName || email.split("@")[0] || "Google User").trim().slice(0, 120);
  let loginKey = slugifyLoginKey(email.split("@")[0]) || `google.${String(sub || "").slice(0, 10)}`;

  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? loginKey : `${loginKey}.${i}`;
    const [clash] = await pool.query(`SELECT id FROM app_users WHERE login_key = :k LIMIT 1`, { k: candidate });
    if (!clash.length) {
      loginKey = candidate;
      break;
    }
  }

  if (employeeId) {
    await pool.query(`UPDATE app_users SET employee_id = NULL WHERE employee_id = :employee_id`, {
      employee_id: employeeId,
    });
  }

  const [result] = await pool.query(
    `INSERT INTO app_users (login_key, display_name, role, employee_id, external_id, email, google_sub, is_active)
     VALUES (:login_key, :display_name, :role, :employee_id, NULL, :email, :google_sub, 1)`,
    {
      login_key: loginKey,
      display_name: name,
      role: resolvedRole,
      employee_id: employeeId,
      email: String(email).trim().toLowerCase(),
      google_sub: sub || null,
    }
  );
  return findUserById(result.insertId);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    `INSERT INTO app_sessions (token, user_id, expires_at) VALUES (:token, :user_id, :expires_at)`,
    { token, user_id: userId, expires_at: expires }
  );
  return { token, expiresAt: expires.toISOString() };
}

export async function destroySession(token) {
  if (!token) return;
  await pool.query(`DELETE FROM app_sessions WHERE token = :token`, { token });
}

export async function loadUserByToken(token) {
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.login_key, u.email, u.display_name, u.role, u.employee_id, u.external_id, u.is_active,
            e.name AS employee_name, e.unit AS employee_unit, e.initials AS employee_init
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE s.token = :token AND s.expires_at > NOW() AND u.is_active = 1
     LIMIT 1`,
    { token }
  );
  if (!rows.length) return null;
  return formatUserRow(rows[0]);
}

export function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  if (req.headers["x-session-token"]) return String(req.headers["x-session-token"]).trim();
  if (req.query?.token) return String(req.query.token).trim();
  return null;
}

export function authMiddleware(req, res, next) {
  // Production serves the SPA from this same process — only protect API routes.
  if (!req.path.startsWith("/api") || publicAuthPaths(req.path)) return next();
  const token = extractToken(req);
  loadUserByToken(token)
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: "Sign in required" });
      }
      req.user = user;
      req.token = token;
      next();
    })
    .catch((err) => res.status(500).json({ error: err.message }));
}

export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function requireEmployeeSelfOrAdmin(employeeIdOrName) {
  return (req, res, next) => {
    if (req.user?.isAdmin) return next();
    const target = String(employeeIdOrName);
    const selfId = String(req.user?.employeeId || "");
    const selfName = req.user?.employeeName || "";
    if (target === selfId || target === selfName) return next();
    return res.status(403).json({ error: "You can only view your own profile" });
  };
}

export async function listDirectory() {
  const [rows] = await pool.query(
    `SELECT u.id, u.login_key, u.display_name, u.role, u.employee_id, u.external_id,
            e.name AS employee_name, e.unit AS employee_unit, e.initials AS employee_init
     FROM app_users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.is_active = 1
     ORDER BY u.role ASC, u.display_name ASC`
  );
  return rows.map((u) => ({
    id: u.id,
    loginKey: u.login_key,
    displayName: u.display_name,
    role: u.role,
    employeeId: u.employee_id,
    externalId: u.external_id,
    employeeName: u.employee_name,
    employeeUnit: u.employee_unit,
    employeeInit: u.employee_init,
  }));
}

export async function getMemberProjectIds(employeeId) {
  if (!employeeId) return [];
  const [rows] = await pool.query(
    `SELECT project_id FROM project_members WHERE employee_id = :eid`,
    { eid: employeeId }
  );
  return rows.map((r) => r.project_id);
}

export async function isProjectMember(employeeId, projectIdOrName) {
  if (!employeeId) return false;
  const isNum = /^\d+$/.test(String(projectIdOrName));
  const [rows] = await pool.query(
    isNum
      ? `SELECT 1 FROM project_members pm WHERE pm.employee_id = :eid AND pm.project_id = :pid LIMIT 1`
      : `SELECT 1 FROM project_members pm
         JOIN projects p ON p.id = pm.project_id
         WHERE pm.employee_id = :eid AND p.name = :pid LIMIT 1`,
    { eid: employeeId, pid: projectIdOrName }
  );
  return rows.length > 0;
}
