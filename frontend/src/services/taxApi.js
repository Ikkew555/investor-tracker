/**
 * ─────────────────────────────────────────────────────────────
 * All API calls for the Tax module and Market prices.
 * Maps 1-to-1 with the backend endpoints in tle_airflow branch.
 *
 * Usage:
 *   import { getCgtSummary } from '../services/taxApi'
 *   const data = await getCgtSummary(userId)
 * ─────────────────────────────────────────────────────────────
 */

import { apiGet, apiPost } from './apiClient'
import { supabase } from '../lib/supabase'

// Compute current Australian financial year dynamically (July 1 – June 30).
// e.g. May 2026 → FY2026, August 2025 → FY2026
function _currentAuFY() {
  const now = new Date()
  const year = now.getFullYear()
  return `FY${now.getMonth() >= 6 ? year + 1 : year}`
}
export const DEFAULT_FY = _currentAuFY()

// ── Helper: get current user's UUID from Supabase session ─────
// Call this once at the top of any component that needs userId
export async function getCurrentUserId() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.user?.id) throw new Error('User not authenticated')
  return session.user.id
}

// ─────────────────────────────────────────────────────────────
// TAX ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/tax/meta
 * Portfolio-level metadata: owner name, date range, currency, etc.
 */
export function getTaxMeta(userId) {
  return apiGet(`/api/tax/meta?userId=${userId}`)
}

/**
 * GET /api/tax/cgt-summary
 * Aggregated CGT totals: total gains, losses, discounted gain, net taxable gain.
 * Maps to: cgt_summary block in output1_individual.json
 */
export function getCgtSummary(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/cgt-summary?userId=${userId}&fy=${fy}`)
}

/**
 * GET /api/tax/cgt-events
 * List of individual disposal events (sales).
 * Optional filters: fy (financial year), symbol, method
 *
 * @param {string} userId
 * @param {Object} filters - { fy?: string, symbol?: string, method?: string }
 */
export function getCgtEvents(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/cgt-events?userId=${userId}&fy=${fy}`)
}

/**
 * GET /api/tax/method-breakdown
 * Breakdown of CGT method usage: FIFO, MinTax, MaxRefund.
 * Maps to: method_breakdown block in output1_individual.json
 */
export function getMethodBreakdown(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/method-breakdown?userId=${userId}&fy=${fy}`)
}

/**
 * GET /api/tax/dividend-summary
 * Aggregated dividend totals: cash income, franking credits, grossed-up income.
 * Maps to: dividend_summary block in output1_individual.json
 */
export function getDividendSummary(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/dividend-summary?userId=${userId}&fy=${fy}`)
}

/**
 * GET /api/tax/dividend-events
 * List of individual dividend payment events.
 * Optional filters: fy, symbol, franking_status
 *
 * @param {string} userId
 * @param {Object} filters - { fy?: string, symbol?: string, franking_status?: string }
 */
export function getDividendEvents(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/dividend-events?userId=${userId}&fy=${fy}`)
}

/**
 * GET /api/tax/remaining-parcels
 * Current open parcels (unsold lots) with cost base and unrealised CGT.
 * Maps to: remaining_parcels block in output1_individual.json
 */
export function getRemainingParcels(userId, fy = DEFAULT_FY) {
  return apiGet(`/api/tax/remaining-parcels?userId=${userId}&fy=${fy}`)
}

/**
 * POST /api/tax/cgt-calculate
 * On-demand CGT calculation for a given disposal scenario.
 * Replaces the hardcoded mock in cgtMockData.js.
 *
 * @param {Object} payload - {
 *   user_id: string,
 *   symbol: string,
 *   units: number,
 *   disposal_date: string,   // "YYYY-MM-DD"
 *   disposal_price: number,
 *   method: "fifo" | "mintax" | "maxrefund"
 * }
 */
export function calculateCgt(payload) {
  return apiPost('/api/tax/cgt-calculate', payload)
}

// ─────────────────────────────────────────────────────────────
// MARKET ENDPOINT
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/market/prices
 * Current market prices for a list of symbols.
 * Replaces hardcoded mock prices in cgtMockData.js and RemainingParcels.
 *
 * @param {string[]} symbols - e.g. ['CBA', 'BHP', 'AAPL']
 */
export function getMarketPrices(symbols = []) {
  const params = new URLSearchParams({ symbols: symbols.join(',') })
  return apiGet(`/api/market/prices?${params}`)
}

// ─────────────────────────────────────────────────────────────
// GENERIC FEATURE READER (backend route)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/feature/{feature_name}/{user_id}
 * Generic feature reader — reads from mart tables via feature_map.py.
 * Use for any feature not covered by the typed functions above.
 *
 * @param {string} featureName - e.g. "cgt_summary", "dividend_events"
 * @param {string} userId
 */
export function getFeature(featureName, userId) {
  return apiGet(`/api/feature/${featureName}/${userId}`)
}

// ─────────────────────────────────────────────────────────────
// CONVENIENCE: fetch ALL tax data in one call
// Use this in TaxLanding.jsx to load the overview page
// ─────────────────────────────────────────────────────────────

/**
 * Fetch all tax data for a user.
 * Step 1: fetch meta to discover which financial year actually has data.
 * Step 2: fetch everything else in parallel using that FY.
 * Returns unwrapped data so consumers can access fields directly.
 */
export async function getTaxOverview(userId) {
  // Step 1 — meta tells us the most recent FY that has been computed
  const metaRaw = await getTaxMeta(userId)
  const financialYears = metaRaw?.data?.financial_years ?? []
  // Prefer the most recent FY that has actual CGT events; fall back to highest FY
  const meta = financialYears.find(f => f.has_cgt) ?? financialYears[0] ?? {}
  const fy = meta.financial_year || DEFAULT_FY

  // Step 2 — fetch all report data in parallel using the correct FY
  const [cgtSummaryRaw, dividendSummaryRaw, methodBreakdownRaw, cgtEventsRaw] = await Promise.all([
    getCgtSummary(userId, fy),
    getDividendSummary(userId, fy),
    getMethodBreakdown(userId, fy),
    getCgtEvents(userId, fy),
  ])

  return {
    meta,
    cgtSummary:      cgtSummaryRaw?.data     ?? {},
    dividendSummary: dividendSummaryRaw?.data ?? {},
    methodBreakdown: methodBreakdownRaw?.data ?? {},
    cgtEvents:       cgtEventsRaw?.data       ?? [],
  }
}