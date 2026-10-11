import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const http = axios.create({
  baseURL: `${API}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

async function req(path, { token, method = "GET", body } = {}) {
  try {
    const res = await http.request({
      url: path,
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      // axios ignora body undefined en GET/DELETE; DELETE con body va en data
      ...(body !== undefined ? { data: body } : {}),
    });
    return res.status === 204 ? null : res.data;
  } catch (e) {
    const st = e.response?.status;
    const data = e.response?.data;
    const text = typeof data === "string" ? data : data?.detail || JSON.stringify(data || "");
    throw new Error(`${text || "Error de red"}${st ? ` (HTTP ${st})` : ""}`);
  }
}

export const api = {
  base: API,
  loginUrls: {
    google: `${API}/api/v1/auth/google/login`,
    github: `${API}/api/v1/auth/github/login`,
  },
  me: (token) => req("/auth/me", { token }),
  demoLogin: (email) => req("/auth/demo", { method: "POST", body: { email } }),
  integrations: (token) => req("/integrations", { token }),
  integrationsAll: (token) => req("/integrations/all", { token }),
  connect: (token, provider, account) => req(`/integrations/${provider}`, { token, method: "POST", body: { account } }),
  disconnect: (token, provider) => req(`/integrations/${provider}`, { token, method: "DELETE" }),
  paypalAuthorize: (token) => req("/integrations/paypal/authorize", { token }),
  donate: (pledge) => req("/donations", { method: "POST", body: pledge }),
  paypalDonateOrder: (body) => req("/payments/donate/orders", { method: "POST", body }),
  paypalDonateCapture: (id) => req(`/payments/donate/orders/${id}/capture`, { method: "POST", body: {} }),
  paypalCreateOrder: (token, body) => req("/payments/orders", { token, method: "POST", body }),
  paypalSearch: (token, start, end) =>
    req(`/payments/search?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`, { token }),
  lead: (body) => req("/leads", { method: "POST", body }),
  transactions: (token, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return req(`/transactions${qs ? `?${qs}` : ""}`, { token });
  },
  donations: (token, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return req(`/donations${qs ? `?${qs}` : ""}`, { token });
  },
  agentChat: (message, sessionId, channel = "web") =>
    req("/agent/chat", { method: "POST", body: { message, session_id: sessionId || null, channel } }),
  agentSession: (sessionId, token, channel = "web") => req(`/agent/conversations/${sessionId}?channel=${channel}`, { token }),
  knowledge: (token) => req("/agent/knowledge", { token }),
  addKnowledge: (token, doc) => req("/agent/knowledge", { token, method: "POST", body: doc }),
  summary: (token) => req("/account/summary", { token }),
  updateProfile: (token, profile) => req("/account/profile", { token, method: "PUT", body: profile }),
  acceptTerms: (token, accepted) => req("/account/terms", { token, method: "PUT", body: { accepted } }),
  deleteMe: (token, email) => req("/account/me", { token, method: "DELETE", body: { email } }),
  users: (token, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return req(`/users${qs ? `?${qs}` : ""}`, { token });
  },
  setRole: (token, id, role) => req(`/users/${id}/role`, { token, method: "PUT", body: { role } }),
  setStatus: (token, id, status) => req(`/users/${id}/status`, { token, method: "PATCH", body: { status } }),
  rbac: (token) => req("/rbac/matrix", { token }),
  setPermission: (token, cell) => req("/rbac/matrix", { token, method: "PUT", body: cell }),
  taxEvents: (year) => req(year ? `/tax-calendar/events?year=${year}` : "/tax-calendar/events"),
  taxYears: () => req("/tax-calendar/years"),
  taxDeleteYear: (year, token) => req(`/tax-calendar/events?year=${year}`, { token, method: "DELETE" }),
  content: {
    pos: (token) => req("/content/pos", { token }),
    createPos: (token) => req("/content/pos/routes", { token, method: "POST", body: {} }),
    dian: (token) => req("/content/dian", { token }),
    createDian: (token) => req("/content/dian", { token, method: "POST", body: {} }),
    deleteDian: (token) => req("/content/dian/demo-1", { token, method: "DELETE" }),
    payments: (token) => req("/content/payments", { token }),
    refund: (token) => req("/content/payments/refund", { token, method: "POST", body: {} }),
  },
};
