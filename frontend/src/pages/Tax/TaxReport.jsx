import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DynamicTable from "./DynamicTable";
import ReportChart  from "./ReportChart";
import {
  getTaxMeta,
  getCgtEvents,
  getCgtSummary,
  getMethodBreakdown,
  getDividendEvents,
  getDividendSummary,
  getRemainingParcels,
} from "../../services/taxApi";
import { useAuth } from "../../contexts/AuthContext";

const FULL_CONTENT_REPORTS = new Set([
  "cgt_events","cgt_summary","method_breakdown",
  "dividend_events","dividend_summary","remaining_parcels",
]);
const NEEDS_CGT_EVENTS      = new Set(["cgt_summary", "method_breakdown"]);
const NEEDS_DIVIDEND_EVENTS = new Set(["dividend_summary"]);

const FETCH_MAP = {
  cgt_events:        getCgtEvents,
  cgt_summary:       getCgtSummary,
  method_breakdown:  getMethodBreakdown,
  dividend_events:   getDividendEvents,
  dividend_summary:  getDividendSummary,
  remaining_parcels: getRemainingParcels,
};

function Skeleton({ width = "100%", height = 20, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, #f0ede8 25%, #e8e5e0 50%, #f0ede8 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

function LoadingState({ C }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", background: C.bg }}>
            <Skeleton width="60%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={22} style={{ marginBottom: 6 }} />
            <Skeleton width="50%" height={11} />
          </div>
        ))}
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, background: C.bg }}>
        <Skeleton width="40%" height={14} style={{ marginBottom: 16 }} />
        <Skeleton height={120} />
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <Skeleton height={40} radius={0} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}` }}>
            <Skeleton width={`${60 + (i % 3) * 15}%`} height={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry, C }) {
  return (
    <div style={{
      border: "1px solid #F09595", borderRadius: 10, padding: "16px 20px",
      background: "#FEF2F2", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <span style={{ fontSize: 13, color: "#B91C1C" }}>{message}</span>
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          fontSize: 12, padding: "6px 14px", borderRadius: 8,
          border: "1px solid #F09595", background: "transparent",
          color: "#B91C1C", cursor: "pointer", whiteSpace: "nowrap",
        }}>
          Try again
        </button>
      )}
    </div>
  );
}

export default function TaxReport({ report, C, onBack }) {
  const { user, loading: authLoading } = useAuth();
  const userId  = user?.id;
  const enabled = !authLoading && !!userId;

  const isFullContent = FULL_CONTENT_REPORTS.has(report.id);
  const fetchFn       = FETCH_MAP[report.id];

  const { data: metaResult } = useQuery({
    queryKey: ["tax-meta", userId],
    queryFn:  () => getTaxMeta(userId),
    staleTime: 86_400_000,
    enabled,
  });
  const allFYs = metaResult?.data?.financial_years ?? [];
  const defaultFY = (allFYs.find(f => f.has_cgt) ?? allFYs[0])?.financial_year ?? null;
  const [selectedFY, setSelectedFY] = useState(null);
  const fy = selectedFY ?? defaultFY;
  const meta = allFYs.find(f => f.financial_year === fy) ?? allFYs[0] ?? null;
  const fyEnabled = enabled && !!fy;

  const { data: primaryRes, isLoading: primaryLoading, error: primaryError } = useQuery({
    queryKey: ["tax-report", report.id, userId, fy],
    queryFn:  () => fetchFn ? fetchFn(userId, fy) : Promise.resolve(null),
    staleTime: 86_400_000,
    enabled:  fyEnabled && !!fetchFn,
  });

  const { data: cgtEventsRes } = useQuery({
    queryKey: ["cgt-events", userId, fy],
    queryFn:  () => getCgtEvents(userId, fy),
    staleTime: 86_400_000,
    enabled:  fyEnabled && NEEDS_CGT_EVENTS.has(report.id),
  });
  const { data: divEventsRes } = useQuery({
    queryKey: ["dividend-events", userId, fy],
    queryFn:  () => getDividendEvents(userId, fy),
    staleTime: 86_400_000,
    enabled:  fyEnabled && NEEDS_DIVIDEND_EVENTS.has(report.id),
  });

  const loading = !metaResult || primaryLoading;
  const error   = primaryError?.message || null;
  const data    = primaryRes?.data ?? primaryRes ?? null;
  const extraData = useMemo(() => ({
    cgtEvents:      cgtEventsRes?.data ?? [],
    dividendEvents: divEventsRes?.data ?? [],
  }), [cgtEventsRes, divEventsRes]);

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Breadcrumb */}
      <div className="tax-breadcrumb">
        <span>🏠</span>
        <span className="tax-breadcrumb__sep">›</span>
        <span
          className="tax-breadcrumb__link"
          style={{ color: C.accent, cursor: "pointer" }}
          onClick={onBack}
        >
          Tax
        </span>
        <span className="tax-breadcrumb__sep">›</span>
        <span className="tax-breadcrumb__current" style={{ color: C.text }}>
          {report.title}
        </span>
      </div>

      {/* Title + FY badge/select — use C tokens */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 className="tax-report__title" style={{ color: C.text, margin: 0 }}>{report.title}</h1>
        {loading
          ? <Skeleton width={90} height={28} radius={8} />
          : allFYs.length > 1
            ? (
              <select
                value={fy ?? ""}
                onChange={e => setSelectedFY(e.target.value)}
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: C.fyBadgeText,
                  background: C.fyBadgeBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                  outline: "none",
                }}
              >
                {allFYs.map(f => (
                  <option key={f.financial_year} value={f.financial_year}>
                    {f.financial_year}{f.has_cgt ? "" : " (dividends only)"}
                  </option>
                ))}
              </select>
            )
            : (
              <span style={{
                fontSize: 12,
                background: C.fyBadgeBg,
                color: C.fyBadgeText,
                padding: "3px 10px", borderRadius: 20, fontWeight: 600,
              }}>
                {fy ?? "—"}
              </span>
            )
        }
      </div>
      <p className="tax-report__subtitle" style={{ color: C.muted, marginBottom: 20 }}>
        {report.subtitle}
      </p>

      {error && <ErrorBanner message={error} C={C} />}
      {loading && <LoadingState C={C} />}

      {!loading && !error && isFullContent && (
        <ReportChart
          reportId={report.id}
          data={data}
          C={C}
          extraData={extraData}
          selectedFY={fy}
        />
      )}

      {!loading && !error && !isFullContent && (
        <>
          <ReportChart
            reportId={report.id}
            data={data}
            C={C}
            extraData={extraData}
            selectedFY={fy}
          />
          <div
            className="tax-report__table-card"
            style={{ border: `1px solid ${C.border}` }}
          >
            <div className="tax-report__table-scroll">
              <DynamicTable data={data} C={C} />
            </div>
          </div>
        </>
      )}
    </>
  );
}