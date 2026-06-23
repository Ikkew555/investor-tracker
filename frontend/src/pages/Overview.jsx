import React, { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useTheme as useThemeContext } from "../contexts/ThemeContext";
import { useTheme } from "./Tax/UseTheme";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Legend,
} from "recharts";
import "./Overview.css";

import {
  getTaxOverview,
  DEFAULT_FY,
} from "../services/taxApi";
import { getPerformance, getMultiCurrency, getMultiPeriod, getRecentUploadActivities, getLatestDividend } from "../services/toolsApi";
import { apiGet } from "../services/apiClient";
import { useAuth } from "../contexts/AuthContext";

// GET /api/performance-history/{userId} — Sakkarin's endpoint (branch: feature/overview-performance)
// Returns: { data: [{ date, symbol, closing_value }] }
const getPerformanceHistory = (userId) => apiGet(`/api/performance-history/${userId}`);

// ── Helpers ───────────────────────────────────────────────────────────
const fmtCcy = (n) =>
  Number(n || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
const fmtDec = (n) =>
  Number(n || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  });

const HOLDING_COLORS = [
  "#185fa5", "#1d9e75", "#ba7517", "#d85a30",
  "#888780", "#d3d1c7", "#9b59b6", "#e67e22",
];

// ── Section label — identical to TaxLanding group labels ──────────────
function SectionLabel({ children, C }) {
  return (
    <div
      className="overview-section-label"
      style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}
    >
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function Overview() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { mode } = useThemeContext();
  const CRaw = useTheme(mode);
  const C = CRaw ?? {
    text: "#222", muted: "#888", border: "#E8E6E1", bg: "#fff",
    thBg: "#FAFAF8", thText: "#555", surface: "#fff", accent: "#378ADD",
  };
  const navigate = useNavigate();

  const GREEN = "#1D9E75";
  const BLUE  = "#185FA5";
  const AMBER = "#BA7517";
  const RED   = "#E24B4A";

  const enabled = !authLoading && !!userId;

  // ── Parallel queries — each with its own cache key + TTL ────────────
const [perfQ, taxOverviewQ, recentUploadQ, latestDividendQ, mcQ, mpQ, histQ] = useQueries({ queries: [
    { queryKey: ["performance",      userId], queryFn: () => getPerformance(userId),             staleTime: 1_200_000,  enabled },
    { queryKey: ["tax-overview",     userId], queryFn: () => getTaxOverview(userId),             staleTime: 86_400_000, enabled },
    { queryKey: ["recent-upload",    userId], queryFn: () => getRecentUploadActivities(userId),  staleTime: 60_000,     enabled },
    { queryKey: ["latest-dividend",  userId], queryFn: () => getLatestDividend(userId),          staleTime: 60_000,     enabled },
    { queryKey: ["multi-currency",   userId], queryFn: () => getMultiCurrency(userId),           staleTime: 1_200_000,  enabled },
    { queryKey: ["multi-period",     userId], queryFn: () => getMultiPeriod(userId),             staleTime: 1_200_000,  enabled },
    { queryKey: ["perf-history",     userId], queryFn: () => getPerformanceHistory(userId),      staleTime: 1_200_000,  enabled, retry: false },
  ]});

  // histQ is optional — exclude from main loading/error
  const loading = [perfQ, taxOverviewQ, recentUploadQ, latestDividendQ, mcQ, mpQ].some(q => q.isLoading);
  const error   = [perfQ, taxOverviewQ, recentUploadQ, latestDividendQ, mcQ, mpQ].find(q => q.error)?.error?.message || null;

  // ── Derive all display values from query results ─────────────────────
  const derived = useMemo(() => {
    const perfRows         = perfQ.data?.data                    ?? [];
    const cgtData          = taxOverviewQ.data?.cgtSummary        ?? {};
    const divData          = taxOverviewQ.data?.dividendSummary    ?? {};
    const taxFY            = taxOverviewQ.data?.meta?.financial_year ?? null;
    const recentUploadRows = recentUploadQ.data?.data              ?? [];
    const mcRows           = mcQ.data?.data                        ?? [];
    const mpRows           = mpQ.data?.data                        ?? [];

    const pv  = perfRows.reduce((s, r) => s + parseFloat(r.closing_value   || 0), 0);
    const ov  = perfRows.reduce((s, r) => s + parseFloat(r.opening_value   || 0), 0);
    const tr  = perfRows.reduce((s, r) => s + parseFloat(r.total_return    || 0), 0);
    const cg  = perfRows.reduce((s, r) => s + parseFloat(r.capital_gain    || 0), 0);
    const di  = perfRows.reduce((s, r) => s + parseFloat(r.dividend_income || 0), 0);
    const trp = ov > 0 ? (tr / ov) * 100 : 0;
    const fd  = perfRows[0]?.from_date ?? null;
    const td  = perfRows[0]?.to_date   ?? null;
    const fy  = td ? `FY${new Date(td).getFullYear()}` : DEFAULT_FY;

    const sortedHoldings = [...perfRows].sort((a, b) => parseFloat(b.closing_value || 0) - parseFloat(a.closing_value || 0));
    const top5      = sortedHoldings.slice(0, 5);
    const othersVal = sortedHoldings.slice(5).reduce((s, r) => s + parseFloat(r.closing_value || 0), 0);
    const hData = [
      ...top5.map((r, i) => ({ symbol: r.symbol, value: parseFloat(r.closing_value || 0), color: HOLDING_COLORS[i], pct: pv > 0 ? (parseFloat(r.closing_value || 0) / pv) * 100 : 0 })),
      ...(othersVal > 0 ? [{ symbol: "Others", value: othersVal, color: HOLDING_COLORS[5], pct: pv > 0 ? (othersVal / pv) * 100 : 0 }] : []),
    ];

    const fcr = parseFloat(divData.total_franking_credits  || 0);
    const gui = parseFloat(divData.total_grossed_up_income || 0);
    const fr  = gui > 0 ? Math.round((fcr / gui) * 100) : 0;

    // Recent Activity: rows from the most recent CSV upload batch (upstream)
    // Falls back to mock data if API returns empty
    const liveActivity = recentUploadRows.map(r => {
      const typeLabel = (r.type || '').toUpperCase();
      const dateStr   = r.date ? new Date(r.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : '-';
      return {
        type:     typeLabel === 'DIVIDEND' ? 'dividend' : typeLabel === 'BUY' ? 'buy' : 'sale',
        symbol:   r.symbol || '—',
        date:     r.date || '',
        detail:   `${dateStr} · ${typeLabel}`,
        amount:   parseFloat(r.total_amount || 0),
        positive: typeLabel !== 'SELL',
        href:     typeLabel === 'DIVIDEND' ? '/tax' : '/tools',
      };
    });
    const mockActivity = [
      { type: "dividend", symbol: "CBA",      date: "2024-03-28", detail: "28 Mar 2024",                 amount: 1462, positive: true,  href: "/tax" },
      { type: "sale",     symbol: "BHP ×50",  date: "2024-02-15", detail: "15 Feb 2024 · held 412 days", amount: 5830, positive: true,  href: "/tax" },
      { type: "dividend", symbol: "WBC",      date: "2024-01-10", detail: "10 Jan 2024",                 amount:  820, positive: true,  href: "/tax" },
      { type: "sale",     symbol: "TLS ×200", date: "2023-12-05", detail: "05 Dec 2023 · held 198 days", amount: -240, positive: false, href: "/tax" },
      { type: "dividend", symbol: "BHP",      date: "2023-11-20", detail: "20 Nov 2023",                 amount:  930, positive: true,  href: "/tax" },
    ];
    const activity = liveActivity.length > 0 ? liveActivity : mockActivity;

    // Most recent dividend ever received by the user
    const nextDiv = latestDividendQ.data?.data ?? null;

    const currRows = mcRows.filter(r => r.group_type === 'currency');
    const audRow   = currRows.find(r => r.group_value === 'AUD');
    const aw       = audRow ? parseFloat(audRow.weight_pct || 0) : 100;
    const tf       = currRows.filter(r => r.group_value !== 'AUD').sort((a, b) => parseFloat(b.weight_pct || 0) - parseFloat(a.weight_pct || 0))[0] || null;

    const pData = mpRows.map(r => ({ label: r.period_label, ret: parseFloat(r.total_return || 0), pct: parseFloat(r.total_return_pct || 0) }));

    // Use tax meta FY if available, otherwise derive from performance data
    const displayFY = taxFY ?? fy;

    return { portfolioValue: pv, openingValue: ov, totalReturn: tr, totalReturnPct: trp, capitalGain: cg, dividendIncome: di, fromDate: fd, toDate: td, financialYear: displayFY, holdingsData: hData, cgt: cgtData, div: divData, frankingRatio: fr, rawActivity: activity, nextDividend: nextDiv, audWeight: aw, topForeign: tf, periodData: pData };
  }, [perfQ.data, taxOverviewQ.data, recentUploadQ.data, latestDividendQ.data, mcQ.data, mpQ.data]);

  const { portfolioValue, openingValue, totalReturn, totalReturnPct, capitalGain, dividendIncome,
          fromDate, toDate, financialYear, holdingsData, cgt, div, frankingRatio,
          rawActivity, nextDividend, audWeight, topForeign, periodData } = derived;

  // ── Time-series: use real /api/performance-history/{userId} if available,
  //    fall back to 12-month mock from holdingsData
  //    Response shape: { data: [{ date, symbol, closing_value }] }
  const timeSeriesData = useMemo(() => {
    const histRows = histQ.data?.data ?? [];
    const acquiredDates = histQ.data?.acquired_dates ?? {};

    // ── Real data path ─────────────────────────────────────────────────
    if (histRows.length > 0) {
      // Find earliest purchase date across all holdings
      const dates = Object.values(acquiredDates).filter(Boolean).sort();
      const earliestDate = dates[0] ?? null;

      // Group by date → { date: { symbol: value, ... } }, filtered from first purchase
      const byDate = {};
      histRows.forEach(r => {
        if (earliestDate && r.date < earliestDate) return;
        if (!byDate[r.date]) byDate[r.date] = { month: r.date.slice(0, 7) };
        byDate[r.date][r.symbol] = (byDate[r.date][r.symbol] || 0) + parseFloat(r.closing_value || 0);
      });
      return Object.values(byDate)
        .sort((a, b) => a.month.localeCompare(b.month));
    }

    // ── Mock fallback (TODO: remove when API returns data) ─────────────
    if (holdingsData.length === 0) return [];
    const symbols = holdingsData.slice(0, 5);
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d     = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const label = d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
      const entry = { month: label };
      symbols.forEach((h, si) => {
        const base   = h.value * (0.55 + i * 0.04);
        const jitter = 1 + Math.sin((i + si) * 1.3) * 0.04;
        entry[h.symbol] = Math.round(base * jitter);
      });
      return entry;
    });
  }, [histQ.data, holdingsData]);

  // ── Derived display values ──────────────────────────────────────────
  const cardBg  = mode === "dark" ? C.surface : "#fff";
  const cardBdr = `1px solid ${C.border}`;

  // Capital gain: prefer authoritative tax figure (net, after discount), fallback to performance sum
  const displayCapitalGain    = parseFloat(cgt.net_capital_gain    || 0) || capitalGain;
  // Dividend income: prefer tax figure (cash dividends), fallback to performance sum
  const displayDividendIncome = parseFloat(div.total_cash_dividends || 0) || dividendIncome;

  const kpiCards = [
    {
      label: "Portfolio value",
      value: loading ? "—" : fmtCcy(portfolioValue),
      sub:   "closing value",
      color: C.text,
    },
    {
      label: "Total return",
      value: loading ? "—" : `+${fmtCcy(totalReturn)}`,
      sub:   "capital gain + dividends",
      color: GREEN,
      badge: loading ? null : `+${totalReturnPct.toFixed(2)}%`,
      hero:  true,
    },
    {
      label: "Capital gain",
      value: loading ? "—" : fmtCcy(displayCapitalGain),
      sub:   "net, after losses & discount",
      color: GREEN,
    },
    {
      label: "Dividend income",
      value: loading ? "—" : fmtCcy(displayDividendIncome),
      sub:   "incl. franking credits",
      color: BLUE,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="overview-page" style={{ color: C.text }}>

      {/* ── Breadcrumb ── */}
      <div className="overview-breadcrumb">
        <span style={{ cursor: "pointer" }} onClick={() => navigate("/overview")}>🏠</span>
        <span className="overview-breadcrumb__sep">›</span>
        <span className="overview-breadcrumb__current" style={{ color: C.text }}>Overview</span>
      </div>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 className="overview-page__title" style={{ color: C.text, margin: 0 }}>Overview</h1>
        <span style={{
          fontSize: 12, background: C.fyBadgeBg, color: C.fyBadgeText,
          padding: "3px 10px", borderRadius: 20, fontWeight: 600,
        }}>
          {loading ? "—" : financialYear}
        </span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        Manage your Australian investment portfolio — performance, dividends, and tax.
      </p>

      {error && (
        <div style={{ color: RED, marginBottom: 16, fontSize: 13 }}>{error}</div>
      )}

      {/* ── KPI Row ── */}
      <div className="overview-kpi-row">
        {kpiCards.map((card, i) => (
          <div key={i} className="overview-kpi-card" style={{
            background: cardBg,
            border: card.hero ? `1.5px solid ${BLUE}` : cardBdr,
          }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color, lineHeight: 1.2 }}>
              {card.value}
              {card.badge && (
                <span style={{ fontSize: 13, fontWeight: 600, color: GREEN, marginLeft: 8 }}>{card.badge}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Portfolio Breakdown ── */}
      <SectionLabel C={C}>Portfolio Breakdown</SectionLabel>

      <div className="overview-two-col">
        {/* Stacked area chart */}
        <div style={{ background: cardBg, border: cardBdr, borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>
            Portfolio value over time
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Performance since first purchase by holding
          </div>
          {timeSeriesData.length === 0 ? (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
              {loading ? "Loading…" : "No performance data available."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  {holdingsData.slice(0, 5).map((h, i) => (
                    <linearGradient key={h.symbol} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={h.color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={h.color} stopOpacity={0}    />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={C.border} vertical={false} strokeOpacity={0.6} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: C.muted }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <RechartTooltip
                  formatter={(v, name) => [fmtCcy(v), name]}
                  contentStyle={{
                    fontSize: 12,
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    background: cardBg,
                    color: C.text,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                    padding: "10px 14px",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4, color: C.muted }}
                  cursor={{ stroke: C.muted, strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
                {holdingsData.slice(0, 5).map((h, i) => (
                  <Area
                    key={h.symbol}
                    type="natural"
                    dataKey={h.symbol}
                    stroke={h.color}
                    strokeWidth={2.5}
                    fill={`url(#grad${i})`}
                    connectNulls={true}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: cardBg, fill: h.color }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Snapshot side cards */}
        <div className="overview-snapshot-col">
          {/* Tax summary → /tax */}
          <div
            className="overview-snapshot-card"
            style={{ background: cardBg, border: cardBdr, borderLeft: `3px solid ${AMBER}` }}
            onClick={() => navigate("/tax")}
          >
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
              Tax summary · {loading ? "—" : financialYear}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Net CGT: {loading ? "—" : fmtCcy(cgt.net_capital_gain)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {loading
                ? "—"
                : `Gross gain ${fmtCcy(cgt.total_gross_gains)} · losses ${fmtCcy(cgt.total_capital_losses)}`}
            </div>
            <span style={{ fontSize: 11, color: AMBER }}>→ View Tax page</span>
          </div>

          {/* Most recent dividend → /tools */}
          <div
            className="overview-snapshot-card"
            style={{ background: cardBg, border: cardBdr, borderLeft: `3px solid ${BLUE}` }}
            onClick={() => navigate("/tools")}
          >
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Most recent dividend</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {loading || !nextDividend
                ? "—"
                : `${fmtCcy(nextDividend.total_amount)} · ${new Date(nextDividend.date).toLocaleDateString("en-AU",
                    { day: "2-digit", month: "short" })}`}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
              {nextDividend ? `${nextDividend.symbol} dividend` : "No dividend data"}
            </div>
            <span style={{ fontSize: 11, color: BLUE }}>→ Open Calendar</span>
          </div>
        </div>
      </div>

      {/* ── Snapshot Row ── */}
      <SectionLabel C={C}>Snapshot</SectionLabel>

      <div className="overview-snapshot-row">
        {/* Franking Credit Meter */}
        <div
          className="overview-snapshot-tile"
          style={{ background: C.frankingBg, border: `0.5px solid ${C.frankingBorder}` }}
          onClick={() => navigate("/tax")}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: C.frankingText, marginBottom: 4 }}>Franking credit meter</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.frankingText, marginBottom: 2 }}>
            {loading ? "—" : fmtDec(div.total_franking_credits)}
          </div>
          <div style={{ fontSize: 11, color: C.frankingMuted, marginBottom: 10 }}>
            {loading ? "" : `grossed-up: ${fmtDec(div.total_grossed_up_income)}`}
          </div>
          <div style={{ background: C.frankingBorder, borderRadius: 4, height: 5, marginBottom: 6 }}>
            <div style={{ background: C.frankingValue, width: `${frankingRatio}%`, height: "100%", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 10, color: C.frankingText, marginBottom: 8 }}>
            {frankingRatio}% utilised · {financialYear}
          </div>
          <span style={{ fontSize: 11, color: C.frankingMuted }}>→ View franking credits</span>
        </div>

        {/* FX Exposure */}
        <div
          className="overview-snapshot-tile"
          style={{ background: cardBg, border: cardBdr }}
          onClick={() => navigate("/tools")}
        >
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
            FX exposure
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 2 }}>
            {loading
              ? "—"
              : topForeign
                ? `${parseFloat(topForeign.weight_pct).toFixed(1)}% ${topForeign.group_value}`
                : "100% AUD"}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
            {loading
              ? ""
              : topForeign
                ? `AUD ${audWeight.toFixed(1)}% · ${topForeign.group_value} ${parseFloat(topForeign.weight_pct).toFixed(1)}%`
                : "All holdings in AUD"}
          </div>
          <div style={{ background: C.border, borderRadius: 4, height: 6, marginBottom: 10 }}>
            <div style={{ background: BLUE, width: `${audWeight}%`, height: "100%", borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted, marginBottom: 8 }}>
            <span>
              <span style={{ display: "inline-block", width: 8, height: 8, background: BLUE, borderRadius: 2, marginRight: 4 }} />
              AUD
            </span>
            {topForeign && (
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, background: "#d3d1c7", borderRadius: 2, marginRight: 4 }} />
                {topForeign.group_value}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: BLUE }}>→ Multi-currency view</span>
        </div>

        {/* Period performance (Opening / Closing) */}
        <div className="overview-snapshot-tile--static" style={{ background: cardBg, border: cardBdr }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Period performance
          </div>
          <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>Opening</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.muted }}>
                {loading ? "—" : fmtCcy(openingValue)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 4 }}>Closing</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GREEN }}>
                {loading ? "—" : fmtCcy(portfolioValue)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {loading
              ? "—"
              : fromDate && toDate
                ? `${fromDate} → ${toDate}`
                : "—"}
          </div>
        </div>
      </div>

      {/* ── Recent Activity + Multi-Period ── */}
      <SectionLabel C={C}>Recent Activity</SectionLabel>

      <div className="overview-bottom-row">
        {/* Activity feed */}
        <div className="overview-activity-card" style={{ background: cardBg, border: cardBdr }}>
          {loading ? (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : rawActivity.length === 0 ? (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>No recent activity.</div>
          ) : (
            rawActivity.map((item, i) => (
              <div
                key={i}
                className="overview-activity-row"
                style={{
                  borderBottom: i < rawActivity.length - 1 ? `1px solid ${C.border}` : "none",
                  background: "transparent",
                }}
                onClick={() => navigate(item.href)}
              >
                <div className="overview-activity-icon" style={{
                  background: item.type === "dividend"
                    ? (mode === "dark" ? "#0a2a1f" : "#E1F5EE")
                    : item.type === "buy"
                    ? (mode === "dark" ? "#0a1a2f" : "#E1EDFB")
                    : (mode === "dark" ? "#2a1e08" : "#FAEEDA"),
                  color: item.type === "dividend" ? GREEN : item.type === "buy" ? BLUE : AMBER,
                }}>
                  {item.type === "dividend" ? "$" : item.type === "buy" ? "↓" : "↑"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {item.type === "dividend" ? "Dividend" : item.type === "buy" ? "Bought" : "Sold"} — {item.symbol}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{item.detail}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.positive ? GREEN : RED }}>
                  {item.positive ? "+" : ""}${Math.abs(item.amount).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Multi-period returns table */}
        <div className="overview-period-card" style={{ background: cardBg, border: cardBdr }}>
          <div style={{ padding: "12px 18px 8px", fontSize: 11, color: C.muted }}>Returns by period</div>
          <div className="overview-period-header" style={{ background: C.thBg }}>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.thText }}>Period</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.thText, textAlign: "right", width: 100 }}>Total return</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.thText, textAlign: "right", width: 60 }}>%</span>
          </div>
          {loading ? (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : periodData.length === 0 ? (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>No period data.</div>
          ) : (
            periodData.map((p, i) => (
              <div
                key={i}
                className="overview-period-row"
                style={{ borderTop: `1px solid ${C.border}`, background: "transparent" }}
                onClick={() => navigate("/tools")}
              >
                <span style={{ flex: 1, fontSize: 13, color: C.text }}>{p.label}</span>
                <span style={{ fontSize: 13, color: p.ret >= 0 ? GREEN : RED, textAlign: "right", width: 100 }}>
                  {p.ret >= 0 ? "+" : ""}{fmtCcy(p.ret)}
                </span>
                <span style={{ fontSize: 13, color: p.pct >= 0 ? GREEN : RED, textAlign: "right", width: 60 }}>
                  {p.pct >= 0 ? "+" : ""}{p.pct.toFixed(2)}%
                </span>
              </div>
            ))
          )}
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: BLUE, cursor: "pointer" }} onClick={() => navigate("/tools")}>
              → Full multi-period report
            </span>
          </div>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div style={{ marginTop: 24 }}>
        <SectionLabel C={C}>Quick Links</SectionLabel>

        <div className="overview-link-grid">
          <a href="/brokers" className="overview-link-card" style={{ border: cardBdr }}>
            <div className="overview-link-card__illustration" style={{ background: C.thBg }}>
              <svg width={52} height={52} viewBox="0 0 52 52" fill="none">
                <rect x={9} y={15} width={34} height={24} rx={3} stroke={BLUE} strokeWidth={1.5} fill="none" />
                <path d="M17 15v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3" stroke={BLUE} strokeWidth={1.5} />
                <path d="M26 24v9M22 29l4 4 4-4" stroke={BLUE} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="overview-link-card__body" style={{ background: cardBg }}>
              <div className="overview-link-card__title" style={{ color: BLUE }}>Upload via Brokers ›</div>
              <div className="overview-link-card__desc" style={{ color: C.muted }}>Upload CSV file via Brokers</div>
            </div>
          </a>
        </div>
      </div>

    </div>
  );
}