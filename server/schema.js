import pool from "./db.js";
import { DOC_TYPE_RUBRICS, equalWeight } from "./rubrics-catalog.js";

async function ensureColumn(conn, table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!Number(rows[0].c)) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

export async function initSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        unit VARCHAR(80) NOT NULL,
        initials VARCHAR(8) NOT NULL,
        ready_pct DECIMAL(5,2) DEFAULT 0,
        consistency_pct DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL UNIQUE,
        client VARCHAR(160) DEFAULT 'Confidential',
        unit VARCHAR(80) NOT NULL,
        status VARCHAR(40) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL UNIQUE,
        short_label VARCHAR(40) NULL,
        sla_days INT NULL,
        sla_note VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS rubric_dimensions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_type_id INT NOT NULL,
        dim_key VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        weight DECIMAL(5,2) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        is_manual TINYINT(1) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        guide_1 TEXT NULL,
        guide_2 TEXT NULL,
        guide_3 TEXT NULL,
        guide_4 TEXT NULL,
        guide_5 TEXT NULL,
        UNIQUE KEY uq_doc_dim (document_type_id, dim_key),
        CONSTRAINT fk_rubric_doctype FOREIGN KEY (document_type_id) REFERENCES document_types(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS rubric_audit (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor VARCHAR(120) NOT NULL,
        action TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        project_id INT NOT NULL,
        document_type_id INT NOT NULL,
        reviewer VARCHAR(120) NOT NULL DEFAULT 'Dhritiman Mitra',
        business_unit VARCHAR(80) NOT NULL,
        client VARCHAR(160) NULL,
        file_name VARCHAR(255) NULL,
        file_size VARCHAR(40) NULL,
        storage_path VARCHAR(500) NULL,
        mime_type VARCHAR(120) NULL,
        file_bytes BIGINT NULL,
        review_date DATE NOT NULL,
        overall_score DECIMAL(4,2) NULL,
        status ENUM('Pending','Approved','Needs Revision','Rejected') NOT NULL DEFAULT 'Pending',
        manager_notes TEXT NULL,
        strengths JSON NULL,
        improvements JSON NULL,
        ai_model VARCHAR(80) NULL,
        credits_used INT NOT NULL DEFAULT 1,
        submitted_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
        CONSTRAINT fk_reviews_project FOREIGN KEY (project_id) REFERENCES projects(id),
        CONSTRAINT fk_reviews_doctype FOREIGN KEY (document_type_id) REFERENCES document_types(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumn(conn, "document_types", "sla_days", "sla_days INT NULL");
    await ensureColumn(conn, "document_types", "sla_note", "sla_note VARCHAR(255) NULL");
    await ensureColumn(conn, "rubric_dimensions", "document_type_id", "document_type_id INT NULL");
    await ensureColumn(conn, "rubric_dimensions", "is_manual", "is_manual TINYINT(1) NOT NULL DEFAULT 0");
    await ensureColumn(conn, "rubric_dimensions", "guide_1", "guide_1 TEXT NULL");
    await ensureColumn(conn, "rubric_dimensions", "guide_2", "guide_2 TEXT NULL");
    await ensureColumn(conn, "rubric_dimensions", "guide_3", "guide_3 TEXT NULL");
    await ensureColumn(conn, "rubric_dimensions", "guide_4", "guide_4 TEXT NULL");
    await ensureColumn(conn, "rubric_dimensions", "guide_5", "guide_5 TEXT NULL");
    await ensureColumn(conn, "reviews", "storage_path", "storage_path VARCHAR(500) NULL");
    await ensureColumn(conn, "reviews", "mime_type", "mime_type VARCHAR(120) NULL");
    await ensureColumn(conn, "reviews", "file_bytes", "file_bytes BIGINT NULL");
    await ensureColumn(conn, "reviews", "ai_model", "ai_model VARCHAR(80) NULL");
    await ensureColumn(conn, "reviews", "credits_used", "credits_used INT NOT NULL DEFAULT 1");
    await ensureColumn(conn, "reviews", "submitted_at", "submitted_at TIMESTAMP NULL");
    await ensureColumn(conn, "reviews", "completed_at", "completed_at TIMESTAMP NULL");
    await ensureColumn(conn, "projects", "status", "status VARCHAR(40) DEFAULT 'Active'");

    // Allow NULL scores until timeline is entered manually
    try {
      await conn.query(`ALTER TABLE review_scores MODIFY score DECIMAL(3,1) NULL`);
    } catch {
      /* ignore if table not ready */
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS review_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_id INT NOT NULL,
        dimension_id INT NOT NULL,
        score DECIMAL(3,1) NULL,
        ai_note TEXT NULL,
        manager_note TEXT NULL,
        UNIQUE KEY uq_review_dim (review_id, dimension_id),
        CONSTRAINT fk_scores_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        CONSTRAINT fk_scores_dimension FOREIGN KEY (dimension_id) REFERENCES rubric_dimensions(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await conn.query(`ALTER TABLE review_scores MODIFY score DECIMAL(3,1) NULL`);
    } catch { /* already nullable */ }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS coaching_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        author VARCHAR(120) NOT NULL DEFAULT 'Dhritiman Mitra',
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_coaching_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        body TEXT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(80) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(
      `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
       ('ai_credits_total', '2000'),
       ('ai_credits_used', '0'),
       ('reviewer_name', 'Dhritiman Mitra'),
       ('reviewer_role', 'Engagement Manager'),
       ('rubrics_version', '0')`
    );

    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login_key VARCHAR(80) NOT NULL UNIQUE,
        display_name VARCHAR(120) NOT NULL,
        role ENUM('admin','employee') NOT NULL,
        employee_id INT NULL,
        external_id VARCHAR(80) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_employee (employee_id),
        CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumn(conn, "app_users", "email", "email VARCHAR(190) NULL");
    await ensureColumn(conn, "app_users", "password_hash", "password_hash VARCHAR(255) NULL");
    await ensureColumn(conn, "app_users", "google_sub", "google_sub VARCHAR(64) NULL");
    // Unique indexes (ignore if already present)
    try {
      await conn.query(`CREATE UNIQUE INDEX uq_app_users_email ON app_users (email)`);
    } catch { /* exists */ }
    try {
      await conn.query(`CREATE UNIQUE INDEX uq_app_users_google_sub ON app_users (google_sub)`);
    } catch { /* exists */ }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        token CHAR(64) PRIMARY KEY,
        user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE,
        KEY idx_sessions_expires (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id INT NOT NULL,
        employee_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, employee_id),
        CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pm_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } finally {
    conn.release();
  }
}

/** Upsert Evernile document types + rubric dimensions. Never wipes review scores. */
export async function syncEvernileRubrics(force = false) {
  const VERSION = "evernile-v1";
  const [verRows] = await pool.query(
    `SELECT setting_value FROM app_settings WHERE setting_key = 'rubrics_version'`
  );
  const setting_value = verRows[0]?.setting_value || "0";

  if (!force && setting_value === VERSION) {
    const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM document_types`);
    const [[{ d }]] = await pool.query(
      `SELECT COUNT(*) AS d FROM rubric_dimensions WHERE document_type_id IS NOT NULL`
    );
    if (c >= 3 && d >= 20) return false;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Allow same dimension name across document types
    try {
      const [idx] = await conn.query(
        `SHOW INDEX FROM rubric_dimensions WHERE Column_name = 'dim_key' AND Non_unique = 0`
      );
      for (const row of idx) {
        if (row.Key_name !== "PRIMARY" && row.Key_name !== "uq_doc_dim") {
          await conn.query(`ALTER TABLE rubric_dimensions DROP INDEX \`${row.Key_name}\``);
        }
      }
    } catch { /* ignore */ }
    try {
      await conn.query(
        `ALTER TABLE rubric_dimensions ADD UNIQUE KEY uq_doc_dim (document_type_id, dim_key)`
      );
    } catch { /* already exists */ }

    const keepNames = DOC_TYPE_RUBRICS.map((d) => d.name);

    for (const doc of DOC_TYPE_RUBRICS) {
      await conn.query(
        `INSERT INTO document_types (name, short_label, sla_days, sla_note)
         VALUES (:name, :short_label, :sla_days, :sla_note)
         ON DUPLICATE KEY UPDATE short_label = VALUES(short_label),
           sla_days = VALUES(sla_days), sla_note = VALUES(sla_note)`,
        {
          name: doc.name,
          short_label: doc.short_label,
          sla_days: doc.sla_days,
          sla_note: doc.sla_note,
        }
      );
    }

    const [docs] = await conn.query(`SELECT id, name FROM document_types`);
    const docMap = Object.fromEntries(docs.map((d) => [d.name, d.id]));
    const keepDimIds = [];

    for (const doc of DOC_TYPE_RUBRICS) {
      const docId = docMap[doc.name];
      if (!docId) continue;
      const w = equalWeight(doc.dimensions.length);
      for (let i = 0; i < doc.dimensions.length; i++) {
        const dim = doc.dimensions[i];
        const guides = dim.guides || [];
        await conn.query(
          `INSERT INTO rubric_dimensions
            (document_type_id, dim_key, description, weight, enabled, is_manual, sort_order,
             guide_1, guide_2, guide_3, guide_4, guide_5)
           VALUES
            (:document_type_id, :dim_key, :description, :weight, 1, :is_manual, :sort_order,
             :g1, :g2, :g3, :g4, :g5)
           ON DUPLICATE KEY UPDATE
             weight = VALUES(weight),
             enabled = 1,
             is_manual = VALUES(is_manual),
             sort_order = VALUES(sort_order)`,
          {
            document_type_id: docId,
            dim_key: dim.key,
            description: guides[4] || guides[3] || dim.key,
            weight: w,
            is_manual: dim.is_manual ? 1 : 0,
            sort_order: i + 1,
            g1: guides[0] || null,
            g2: guides[1] || null,
            g3: guides[2] || null,
            g4: guides[3] || null,
            g5: guides[4] || null,
          }
        );
        const [[{ id }]] = await conn.query(
          `SELECT id FROM rubric_dimensions
           WHERE document_type_id = :document_type_id AND dim_key = :dim_key`,
          { document_type_id: docId, dim_key: dim.key }
        );
        keepDimIds.push(id);
      }
    }

    // Soft-disable obsolete dimensions (keep rows so historical scores stay valid)
    if (keepDimIds.length) {
      await conn.query(
        `UPDATE rubric_dimensions SET enabled = 0
         WHERE id NOT IN (${keepDimIds.map(() => "?").join(",")})`,
        keepDimIds
      );
    }

    // Remap reviews off non-catalog document types, then remove those types if unused
    const [orphanDocs] = await conn.query(
      `SELECT id, name FROM document_types WHERE name NOT IN (${keepNames.map(() => "?").join(",")})`,
      keepNames
    );
    const fallbackId = docMap[keepNames[0]];
    for (const row of orphanDocs) {
      if (fallbackId) {
        await conn.query(
          `UPDATE reviews SET document_type_id = :fallback WHERE document_type_id = :id`,
          { fallback: fallbackId, id: row.id }
        );
      }
      const [[{ c }]] = await conn.query(
        `SELECT COUNT(*) AS c FROM reviews WHERE document_type_id = :id`,
        { id: row.id }
      );
      if (!Number(c)) {
        await conn.query(`DELETE FROM document_types WHERE id = :id`, { id: row.id }).catch(() => {});
      }
    }

    await conn.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('rubrics_version', :v)
       ON DUPLICATE KEY UPDATE setting_value = :v`,
      { v: VERSION }
    );
    if (setting_value !== VERSION) {
      await conn.query(
        `INSERT INTO rubric_audit (actor, action) VALUES ('System', :action)`,
        { action: `Synced Evernile rubrics (${VERSION}) — Teaser, IM/CIM, Financial Model` }
      );
    }

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Canonical analyst roster (names you provided). Not demo reviews/projects. */
const CORE_EMPLOYEES = [
  ["Abhinav Dasgupta", "Investment Banking", "AD", 92, 96],
  ["Banala Dinesh", "Consulting", "BD", 86, 91],
  ["Devyansh Rajput", "Investment Banking", "DR", 83, 88],
  ["Dhritiman Mitra", "Deal Advisory", "DM", 80, 86],
  ["Mayank Yadav", "Deal Advisory", "MY", 74, 82],
  ["Rishabh Mannari", "Research", "RM", 71, 80],
  ["Rudransh Bhardwaj", "Investment Banking", "RB", 68, 77],
  ["Sahil Sachdeva", "Deal Advisory", "SS", 62, 74],
  ["Sumit Pandey", "Consulting", "SP", 58, 72],
  ["Tarun Kumar", "Research", "TK", 52, 69],
  ["Varun Jhaveri", "Research", "VJ", 46, 65],
];

/** Firm admins — these emails are always role=admin (password + Google). */
export const ADMIN_ACCOUNTS = [
  { email: "admin@evernile.com", loginKey: "admin", displayName: "Platform Admin", employeeName: null },
  { email: "dmitra@evernile.com", loginKey: "dmitra", displayName: "Dhritiman Mitra", employeeName: "Dhritiman Mitra" },
  { email: "adasgupta@evernile.com", loginKey: "adasgupta", displayName: "Abhinav Dasgupta", employeeName: "Abhinav Dasgupta" },
  { email: "vjhaveri@evernile.com", loginKey: "vjhaveri", displayName: "Varun Jhaveri", employeeName: "Varun Jhaveri" },
];

export const ADMIN_EMAILS = new Set(ADMIN_ACCOUNTS.map((a) => a.email.toLowerCase()));

export function isAdminEmail(email) {
  return ADMIN_EMAILS.has(String(email || "").trim().toLowerCase());
}

export async function seedIfEmpty() {
  // Demo projects / reviews stay off. Employees are restored via ensureCoreEmployees().
  return false;
}

/** Upsert the firm employee list. Removes retired names. Does not create fake reviews/projects. */
export async function ensureCoreEmployees() {
  let inserted = 0;
  for (const [name, unit, initials, ready, consistency] of CORE_EMPLOYEES) {
    const [res] = await pool.query(
      `INSERT INTO employees (name, unit, initials, ready_pct, consistency_pct)
       VALUES (:name, :unit, :initials, :ready, :consistency)
       ON DUPLICATE KEY UPDATE unit = VALUES(unit), initials = VALUES(initials),
         ready_pct = VALUES(ready_pct), consistency_pct = VALUES(consistency_pct)`,
      { name, unit, initials, ready, consistency }
    );
    if (res.affectedRows === 1) inserted += 1;
  }

  // Remove retired employees (and linked auth / memberships / coaching)
  const keepNames = CORE_EMPLOYEES.map((r) => r[0]);
  const [retired] = await pool.query(
    `SELECT id, name FROM employees WHERE name NOT IN (${keepNames.map(() => "?").join(",")})`,
    keepNames
  );
  for (const row of retired) {
    await pool.query(`DELETE FROM project_members WHERE employee_id = :id`, { id: row.id });
    await pool.query(`DELETE FROM coaching_notes WHERE employee_id = :id`, { id: row.id });
    await pool.query(`UPDATE app_users SET employee_id = NULL WHERE employee_id = :id`, { id: row.id });
    // Keep historical reviews but detach name via SET NULL is not allowed (NOT NULL FK).
    // Soft-approach: delete only if no reviews; otherwise rename is not wanted — delete reviews for retired demo people.
    const [[{ rc }]] = await pool.query(`SELECT COUNT(*) AS rc FROM reviews WHERE employee_id = :id`, { id: row.id });
    if (Number(rc) === 0) {
      await pool.query(`DELETE FROM employees WHERE id = :id`, { id: row.id });
    } else {
      // Detach scores then reviews then employee
      await pool.query(
        `DELETE rs FROM review_scores rs
         JOIN reviews r ON r.id = rs.review_id
         WHERE r.employee_id = :id`,
        { id: row.id }
      );
      await pool.query(`DELETE FROM reviews WHERE employee_id = :id`, { id: row.id });
      await pool.query(`DELETE FROM employees WHERE id = :id`, { id: row.id });
    }
    await pool.query(
      `DELETE FROM app_users WHERE login_key = :lk OR display_name = :name`,
      { lk: slugifyLogin(row.name), name: row.name }
    );
  }

  const [[{ c }]] = await pool.query(`SELECT COUNT(*) AS c FROM employees`);
  return { total: Number(c), inserted, removed: retired.length };
}

/**
 * Wipe reviews/projects/notifications only.
 * NEVER deletes employees, rubrics, document types, or the admin user.
 */
export async function clearDemoData() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("DELETE FROM review_scores");
    await conn.query("DELETE FROM reviews");
    await conn.query("DELETE FROM coaching_notes");
    await conn.query("DELETE FROM project_members");
    await conn.query("DELETE FROM notifications");
    await conn.query("DELETE FROM app_sessions");
    await conn.query("DELETE FROM projects");
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    await conn.query(`UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'ai_credits_used'`);
    await conn.query(
      `INSERT INTO app_users (login_key, display_name, role, employee_id, external_id)
       VALUES ('admin', 'Dhritiman Mitra', 'admin', NULL, NULL)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), role = 'admin', is_active = 1`
    );
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function slugifyLogin(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60);
}

/**
 * Ensure analyst users exist from the employee roster.
 * Skips employees already linked to an admin account.
 */
export async function seedImaAccess() {
  const [emps] = await pool.query(`SELECT id, name FROM employees ORDER BY name`);
  for (const e of emps) {
    const loginKey = slugifyLogin(e.name) || `emp.${e.id}`;

    // If this employee is already linked (e.g. to an admin), leave it alone
    const [linked] = await pool.query(
      `SELECT id, email, role FROM app_users WHERE employee_id = :employee_id LIMIT 1`,
      { employee_id: e.id }
    );
    if (linked.length) {
      if (isAdminEmail(linked[0].email) || linked[0].role === "admin") continue;
      // Keep analyst binding in sync
      await pool.query(
        `UPDATE app_users SET display_name = :display_name, role = 'employee', is_active = 1 WHERE id = :id`,
        { id: linked[0].id, display_name: e.name }
      );
      continue;
    }

    const [existing] = await pool.query(
      `SELECT id, email, role FROM app_users WHERE login_key = :login_key LIMIT 1`,
      { login_key: loginKey }
    );
    if (existing.length) {
      if (isAdminEmail(existing[0].email) || existing[0].role === "admin") continue;
      await pool.query(
        `UPDATE app_users SET display_name = :display_name, employee_id = :employee_id, role = 'employee', is_active = 1
         WHERE id = :id`,
        { id: existing[0].id, display_name: e.name, employee_id: e.id }
      );
    } else {
      await pool.query(
        `INSERT INTO app_users (login_key, display_name, role, employee_id, external_id)
         VALUES (:login_key, :display_name, 'employee', :employee_id, NULL)`,
        { login_key: loginKey, display_name: e.name, employee_id: e.id }
      );
    }
  }

  const [[{ users }]] = await pool.query(`SELECT COUNT(*) AS users FROM app_users`);
  const [[{ members }]] = await pool.query(`SELECT COUNT(*) AS members FROM project_members`);
  return { users: Number(users), members: Number(members) };
}

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "EverGauge2026!";

/**
 * Upsert firm admins with scrypt password hashes; ensure everyone else is Analyst (employee).
 */
export async function seedAuthCredentials() {
  const { hashPassword } = await import("./passwords.js");
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  let adminsUpserted = 0;

  for (const admin of ADMIN_ACCOUNTS) {
    let employeeId = null;
    if (admin.employeeName) {
      const [emps] = await pool.query(`SELECT id FROM employees WHERE name = :name LIMIT 1`, {
        name: admin.employeeName,
      });
      employeeId = emps[0]?.id || null;
    }

    const [byEmail] = await pool.query(
      `SELECT id FROM app_users WHERE LOWER(email) = LOWER(:email) OR login_key = :login_key LIMIT 1`,
      { email: admin.email, login_key: admin.loginKey }
    );

    if (byEmail.length) {
      // Clear employee_id unique conflicts before linking
      if (employeeId) {
        await pool.query(
          `UPDATE app_users SET employee_id = NULL WHERE employee_id = :employee_id AND id <> :id`,
          { employee_id: employeeId, id: byEmail[0].id }
        );
      }
      await pool.query(
        `UPDATE app_users
         SET login_key = :login_key,
             display_name = :display_name,
             role = 'admin',
             email = :email,
             password_hash = :password_hash,
             employee_id = :employee_id,
             is_active = 1
         WHERE id = :id`,
        {
          id: byEmail[0].id,
          login_key: admin.loginKey,
          display_name: admin.displayName,
          email: admin.email,
          password_hash: passwordHash,
          employee_id: employeeId,
        }
      );
    } else {
      if (employeeId) {
        await pool.query(`UPDATE app_users SET employee_id = NULL WHERE employee_id = :employee_id`, {
          employee_id: employeeId,
        });
      }
      await pool.query(
        `INSERT INTO app_users (login_key, display_name, role, employee_id, external_id, email, password_hash, is_active)
         VALUES (:login_key, :display_name, 'admin', :employee_id, NULL, :email, :password_hash, 1)`,
        {
          login_key: admin.loginKey,
          display_name: admin.displayName,
          employee_id: employeeId,
          email: admin.email,
          password_hash: passwordHash,
        }
      );
    }
    adminsUpserted += 1;
  }

  // Analysts: every non-admin active user gets employee role + email + password if missing
  const [rows] = await pool.query(
    `SELECT id, login_key, display_name, role, email, password_hash FROM app_users WHERE is_active = 1`
  );
  let analystsUpdated = 0;
  for (const u of rows) {
    const email = (u.email || "").toLowerCase();
    if (isAdminEmail(email) || ADMIN_ACCOUNTS.some((a) => a.loginKey === u.login_key)) {
      continue;
    }

    let nextEmail = u.email;
    if (!nextEmail) {
      const local = String(u.login_key || slugifyLogin(u.display_name) || `user${u.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9._+-]/g, "")
        .slice(0, 64);
      nextEmail = `${local}@evernile.com`;
    }

    const hash = u.password_hash || passwordHash;
    await pool.query(
      `UPDATE app_users
       SET role = 'employee', email = :email, password_hash = :password_hash, is_active = 1
       WHERE id = :id`,
      { id: u.id, email: nextEmail, password_hash: hash }
    );
    analystsUpdated += 1;
  }

  // Demote any leftover admin not in the allowlist
  await pool.query(
    `UPDATE app_users SET role = 'employee'
     WHERE role = 'admin' AND (email IS NULL OR LOWER(email) NOT IN (${[...ADMIN_EMAILS].map(() => "?").join(",")}))`,
    [...ADMIN_EMAILS]
  );

  return {
    adminsUpserted,
    analystsUpdated,
    defaultPassword: DEFAULT_PASSWORD,
  };
}
