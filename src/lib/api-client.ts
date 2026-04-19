// FastAPI auth client.
// - Access token stored in memory (lost on reload — recovered via /refresh + httpOnly cookie)
// - Refresh token lives in httpOnly cookie set by FastAPI
// - All requests include credentials so the cookie travels
// - On 401, transparently call /refresh and retry once

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";

const AUTH_PREFIX = "/api/v1/auth";

export type AuthUser = { id: string; email: string };

let accessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenListeners.forEach((fn) => fn(token));
}

export function onAccessTokenChange(fn: (token: string | null) => void) {
  tokenListeners.add(fn);
  return () => tokenListeners.delete(fn);
}

type JsonInit = Omit<RequestInit, "body"> & { body?: unknown };

async function rawFetch(path: string, init: JsonInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const body =
    init.body === undefined
      ? undefined
      : init.body instanceof FormData
        ? init.body
        : typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body);

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body,
    credentials: "include", // send/receive httpOnly refresh cookie
  });
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const resp = await rawFetch(`${AUTH_PREFIX}/refresh`, { method: "POST" });
      if (!resp.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await resp.json()) as { access_token?: string };
      if (!data.access_token) {
        setAccessToken(null);
        return null;
      }
      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Authenticated fetch with one-shot refresh-on-401 retry. */
export async function apiFetch(path: string, init: JsonInit = {}): Promise<Response> {
  let resp = await rawFetch(path, init);
  if (resp.status !== 401) return resp;

  // Try to refresh once
  const newToken = await refreshAccessToken();
  if (!newToken) return resp;

  // Retry with new token
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${newToken}`);
  resp = await rawFetch(path, { ...init, headers });
  return resp;
}

async function readError(resp: Response): Promise<string> {
  try {
    const data = (await resp.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return String(data.detail[0].msg);
    return resp.statusText || "Request failed";
  } catch {
    return resp.statusText || "Request failed";
  }
}

// ---- Auth endpoints ----

export async function register(email: string, password: string): Promise<void> {
  const resp = await rawFetch(`${AUTH_PREFIX}/register`, {
    method: "POST",
    body: { email, password },
  });
  if (!resp.ok) throw new Error(await readError(resp));
}

export async function login(email: string, password: string): Promise<{ email: string }> {
  // FastAPI uses OAuth2PasswordRequestForm => form-urlencoded with `username` and `password`
  const form = new URLSearchParams();
  form.set("username", email);
  form.set("password", password);

  const resp = await fetch(`${API_BASE_URL}${AUTH_PREFIX}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    credentials: "include",
  });
  if (!resp.ok) throw new Error(await readError(resp));
  const data = (await resp.json()) as { access_token: string; email?: string };
  setAccessToken(data.access_token);
  return { email: data.email ?? email };
}

export async function logout(): Promise<void> {
  try {
    await rawFetch(`${AUTH_PREFIX}/logout`, { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  const resp = await apiFetch(`${AUTH_PREFIX}/me`, { method: "GET" });
  if (!resp.ok) return null;
  return (await resp.json()) as AuthUser;
}

/** Try to recover a session on app boot using the httpOnly refresh cookie. */
export async function bootstrapSession(): Promise<AuthUser | null> {
  const token = await refreshAccessToken();
  if (!token) return null;
  return fetchMe();
}
