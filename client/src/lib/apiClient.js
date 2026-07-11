import { API_BASE } from './config.js';

/**
 * Single source of truth for talking to the API.
 *
 * Before this, Admin / CreatorPortal / BusinessPortal / DemoAdmin each carried
 * their own `authFetch` plus a hand-copied "401 or 403 → drop the session" check.
 * Four copies of one security-relevant policy is three too many: fixing a bug in
 * one of them fixed it in none of the others.
 *
 * `authFetch` keeps the old Response-returning signature so existing call sites
 * are untouched, but the base URL, the bearer header and the auth-failure policy
 * now live here only. New code should prefer `get`/`post`, which parse the
 * envelope and throw a typed ApiError.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  /** A real auth failure — as opposed to a network blip or a 5xx. */
  get isAuthFailure() {
    return this.status === 401 || this.status === 403;
  }
}

export function createApiClient({ tokenKey, onUnauthorized, persistent = false }) {
  // persistent=true → localStorage: the login survives closing the app, so an
  // installed PWA reopens straight into the cabinet (creator/business). The
  // matching server session already lasts 30 days. Admin stays sessionStorage.
  const store = persistent ? window.localStorage : window.sessionStorage;
  const getToken = () => store.getItem(tokenKey) || '';
  const setToken = (token) => store.setItem(tokenKey, token);
  const clearToken = () => store.removeItem(tokenKey);

  /** Raw fetch with the bearer attached. Returns the Response, like `fetch`. */
  async function authFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    // Only a genuine auth failure ends the session. A transient network error or
    // a 5xx must never log the user out — that was the bug the copies shared.
    if (res.status === 401 || res.status === 403) {
      clearToken();
      onUnauthorized?.();
    }
    return res;
  }

  /** Parsed request: resolves to the JSON body, throws ApiError on failure. */
  async function request(path, { method = 'GET', body, headers } = {}) {
    const hasBody = body !== undefined;
    const res = await authFetch(path, {
      method,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...headers },
    });

    let data = null;
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      data = await res.json().catch(() => null);
    }
    if (!res.ok || data?.ok === false) {
      throw new ApiError(data?.errors?.[0] || `Ошибка ${res.status}`, res.status);
    }
    return data;
  }

  return {
    authFetch,
    getToken,
    setToken,
    clearToken,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
  };
}
