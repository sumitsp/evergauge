const API_BASE = import.meta.env.VITE_API_URL || "";

let authToken = localStorage.getItem("meridianqa_token") || null;

export function setAuthToken(token) {
  authToken = token || null;
  if (token) localStorage.setItem("meridianqa_token", token);
  else localStorage.removeItem("meridianqa_token");
}

export function getAuthToken() {
  return authToken;
}

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

export const api = {
  health: () => request("/api/health"),
  authDirectory: () => request("/api/auth/directory"),
  authConfig: () => request("/api/auth/config"),
  authLogin: (body) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(typeof body === "object" && body != null && !Array.isArray(body) ? body : { userId: body }),
    }),
  authGoogle: (credential) =>
    request("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  authMe: () => request("/api/auth/me"),
  authLogout: () => request("/api/auth/logout", { method: "POST" }),
  bootstrap: () => request("/api/bootstrap"),
  kpis: () => request("/api/dashboard/kpis"),
  employees: () => request("/api/employees"),
  employee: (id) => request(`/api/employees/${encodeURIComponent(id)}`),
  createEmployee: (body) => request("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  coaching: (id) => request(`/api/employees/${encodeURIComponent(id)}/coaching`),
  addCoaching: (id, body) =>
    request(`/api/employees/${encodeURIComponent(id)}/coaching`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  projects: () => request("/api/projects"),
  project: (id) => request(`/api/projects/${encodeURIComponent(id)}`),
  createProject: (body) => request("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  reviews: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    ).toString();
    return request(`/api/reviews${qs ? `?${qs}` : ""}`);
  },
  review: (id) => request(`/api/reviews/${id}`),
  createReview: (body, file) => {
    if (file instanceof File) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => {
        if (v != null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      });
      fd.append("file", file);
      return request("/api/reviews", { method: "POST", body: fd });
    }
    return request("/api/reviews", { method: "POST", body: JSON.stringify(body) });
  },
  updateReview: (id, body) =>
    request(`/api/reviews/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteReview: (id) =>
    request(`/api/reviews/${id}`, { method: "DELETE" }),
  downloadScorecardPdf: async (id) => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/api/reviews/${id}/scorecard.pdf`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || "Download failed");
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `scorecard-${id}.pdf`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  rubric: () => request("/api/rubric"),
  saveRubric: (rows, actor, docType) =>
    request("/api/rubric", { method: "PUT", body: JSON.stringify({ rows, actor, docType }) }),
  downloadRubricAudit: async () => {
    const headers = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/api/rubric/audit/export`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || "Download failed");
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || "evergauge-rubric-audit.xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  analytics: () => request("/api/analytics"),
  notifications: () => request("/api/notifications"),
  readAllNotifications: () => request("/api/notifications/read-all", { method: "POST" }),
  search: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),
  report: (type, format) =>
    request(`/api/reports/${type}${format ? `?format=${format}` : ""}`),
};
