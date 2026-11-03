// API client for the Snip backend (ASP.NET Core API in /backend).
//
// In dev, requests go to the same origin ("/api/...") and the Vite dev
// server proxies them to the API on http://localhost:8080 — see
// vite.config.ts. Set VITE_API_BASE to call a deployed API directly.

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

const TOKEN_KEY = "snip_token";
const USER_KEY = "snip_user";

export interface ApiUser {
  email: string;
  displayName: string;
}

export interface ApiLink {
  id: string;
  slug: string;
  destinationUrl: string;
  shortUrl: string;
  clicks: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface PagedLinks {
  items: ApiLink[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AnalyticsSummary {
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  topLinks: { slug: string; destinationUrl: string; clicks: number }[];
}

export interface DailyClicks {
  date: string; // yyyy-MM-dd
  clicks: number;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): ApiUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as ApiUser) : null;
}

function storeSession(token: string, user: ApiUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && token) {
    // Session expired or token rejected — force a fresh sign-in.
    clearSession();
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<ApiUser> {
  const data = await request<{ token: string; email: string; displayName: string }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
  const user = { email: data.email, displayName: data.displayName };
  storeSession(data.token, user);
  return user;
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<ApiUser> {
  const data = await request<{ token: string; email: string; displayName: string }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify({ email, password, displayName }) }
  );
  const user = { email: data.email, displayName: data.displayName };
  storeSession(data.token, user);
  return user;
}

export async function fetchMe(): Promise<ApiUser> {
  const data = await request<{ email: string; displayName: string }>("/api/auth/me");
  const user = { email: data.email, displayName: data.displayName };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

// ─── Links ──────────────────────────────────────────────────────────────────

export function listLinks(search = "", page = 1, pageSize = 50): Promise<PagedLinks> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (search.trim()) params.set("search", search.trim());
  return request<PagedLinks>(`/api/links?${params.toString()}`);
}

export function createLink(destinationUrl: string, slug?: string): Promise<ApiLink> {
  return request<ApiLink>("/api/links", {
    method: "POST",
    body: JSON.stringify({ destinationUrl, slug: slug?.trim() || null }),
  });
}

export function setLinkActive(id: string, isActive: boolean): Promise<ApiLink> {
  return request<ApiLink>(`/api/links/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function deleteLink(id: string): Promise<void> {
  return request<void>(`/api/links/${id}`, { method: "DELETE" });
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function analyticsSummary(): Promise<AnalyticsSummary> {
  return request<AnalyticsSummary>("/api/analytics/summary");
}

export function analyticsClicks(days = 30): Promise<DailyClicks[]> {
  return request<DailyClicks[]>(`/api/analytics/clicks?days=${days}`);
}
