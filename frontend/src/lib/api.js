import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json();
}

async function getFeature(featureName, userId) {
  return apiFetch(`/api/feature/${featureName}/${userId}`);
}

// ── pipeline trigger ──────────────────────────────────────────────────────────

export async function refreshUser(userId) {
  return apiFetch(`/api/refresh/${userId}`, { method: "POST" });
}

// ── feature endpoints ─────────────────────────────────────────────────────────

export async function getPerformance(userId) {
  return getFeature("performance", userId);
}

export async function getSoldSecurities(userId) {
  return getFeature("sold_securities", userId);
}

export async function getCalendar(userId) {
  return getFeature("calendar", userId);
}

export async function getContributionAnalysis(userId) {
  return getFeature("contribution_analysis", userId);
}

export async function getFutureIncome(userId) {
  return getFeature("future_income", userId);
}

export async function getMultiCurrency(userId) {
  return getFeature("multi_currency", userId);
}

export async function getMultiPeriod(userId) {
  return getFeature("multi_period", userId);
}

export async function getTax(userId) {
  return getFeature("tax", userId);
}
