/**
 * ─────────────────────────────────────────────────────────────
 * Central HTTP client for Nexgen Portfolio backend API.
 * Automatically attaches the Supabase JWT token to every request.
 *
 * Usage:
 *   import { apiFetch } from '../services/apiClient'
 *   const data = await apiFetch('/api/tax/cgt-summary?user_id=xxx')
 * ─────────────────────────────────────────────────────────────
 */

import { supabase } from "../lib/supabase";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const responseCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getFreshToken(retries = 3) {
  for (let i = 0; i < retries; i++) {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (!error && session?.access_token) return session.access_token
    if (i < retries - 1) await new Promise(r => setTimeout(r, 500))
  }
  throw new ApiError('Not authenticated — please log in again.', 401)
}

async function doApiFetch(path, opts = {}, retry = true) {
  const token = await getFreshToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });

  if (response.status === 401 && retry) {
    await supabase.auth.refreshSession();
    return doApiFetch(path, opts, false);
  }

  if (!response.ok) {
    let message = `API error ${response.status}`;

    try {
      const body = await response.json();
      message = body?.detail || body?.message || message;
    } catch (e) {}

    throw new ApiError(message, response.status);
  }

  return response.json();
}

export async function apiFetch(path, opts = {}, retry = true) {
  const method = opts.method || "GET";
  const cacheKey = `${method}:${path}`;

  if (method === "GET") {
    const cached = responseCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const requestPromise = doApiFetch(path, opts, retry);

  if (method === "GET") {
    inFlightRequests.set(cacheKey, requestPromise);
  }

  try {
    const data = await requestPromise;

    if (method === "GET") {
      responseCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });
    }

    return data;
  } finally {
    if (method === "GET") {
      inFlightRequests.delete(cacheKey);
    }
  }
}

export function clearApiCache() {
  responseCache.clear();
  inFlightRequests.clear();
}

export const apiGet = (path) => apiFetch(path);

export const apiPost = (path, body) =>
  apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const apiPut = (path, body) =>
  apiFetch(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const apiDelete = (path) =>
  apiFetch(path, {
    method: "DELETE",
  });