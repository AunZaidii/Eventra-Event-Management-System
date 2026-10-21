// Small fetch wrapper for the Eventra API (always same-origin /api, proxied by Nginx).
const AUTH_KEY = 'eventra.auth';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }

  // { email: 'Enter a valid email address', ... } for showing errors under form fields
  get fieldErrors() {
    return Object.fromEntries(this.details.filter((d) => d.field).map((d) => [d.field, d.message]));
  }
}

// ---- Auth token storage (stateless JWT; nothing kept on the server) ----
export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth.token || new Date(auth.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return auth;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {
    /* storage unavailable (private mode) — token lives in memory via AuthContext */
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

let unauthorizedHandler = null;
export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

// Builds "?a=1&b=2", skipping empty values.
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export async function api(path, { method = 'GET', body, auth = false, signal, raw = false, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const bearer = token || getAuth()?.token;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  if (res.ok && res.status === 204) return null;
  if (res.ok && raw) return res;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    const error = new ApiError(
      res.status,
      e?.code || 'HTTP_ERROR',
      e?.message || (res.status >= 500 ? 'The server had a problem. Please try again.' : 'Something went wrong.'),
      e?.details,
    );
    if (res.status === 401 && auth && unauthorizedHandler) unauthorizedHandler(error);
    throw error;
  }
  return data;
}

// Downloads a file from an authenticated endpoint (used for CSV export).
export async function downloadFile(path, fallbackName) {
  const res = await api(path, { auth: true, raw: true });
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
