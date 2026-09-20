/** Thin wrapper so every hook surfaces server error messages the same way. */

const IMPORT_TOKEN_KEY = "lastfm-import-token";

export function getStoredImportToken(): string {
  if (globalThis.window === undefined) return "";
  return sessionStorage.getItem(IMPORT_TOKEN_KEY) ?? "";
}

export function setStoredImportToken(token: string): void {
  if (globalThis.window === undefined) return;
  if (token) {
    sessionStorage.setItem(IMPORT_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(IMPORT_TOKEN_KEY);
  }
}

function authHeaders(): HeadersInit {
  const token = getStoredImportToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}

export async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  return body as T;
}
