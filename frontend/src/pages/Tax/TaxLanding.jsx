import React from "react";
import { useQuery } from "@tanstack/react-query";
import { REPORTS } from "./Reports";
import { getTaxOverview } from "../../services/taxApi";
import { useAuth } from "../../contexts/AuthContext";
import "../../components/ToolsCard.css";
import "../../components/tools-theme.css";

// ── ReportCard — uses the same CSS class as ToolsCard so hover, shadow,
//   blue border, and ::after bottom-bar all work identically ────────────
function ReportCard({ report, onClick, colors }) {
  const { Illustration, title, subtitle } = report;
  return (
    <div className="tools-card" onClick={onClick}>
      {/* Illustration — same fixed height as tools-card-image */}
      <div style={{ width: "100%", height: 140, overflow: "hidden", display: "block" }}>
        {Illustration
          ? <Illustration colors={colors} />
          : <div style={{ width: "100%", height: "100%", background: "#1B2A3B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 32, opacity: 0.4 }}>📊</span>
            </div>
        }
      </div>
      <h3 className="tools-card-title">{title} <span style={{ fontSize: 16 }}>›</span></h3>
      <p className="tools-card-desc">{subtitle}</p>
    </div>
  );
}

// Loading skeleton
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

// Error banner
function ErrorBanner({ message, C }) {
  return (
    <div style={{
      border: `1px solid #F09595`, borderRadius: 10, padding: "14px 18px",
      background: "#FEF2F2", color: "#B91C1C", fontSize: 13, marginBottom: 16,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

export default function TaxLanding({ C: CProp, onSelect, onCGT }) {
  // Guard: if C hasn't been initialised yet (theme still loading), use safe defaults
  const C = CProp ?? {
    text: "#222", muted: "#888", border: "#E8E6E1", bg: "#fff",
    thBg: "#FAFAF8", thText: "#555", surface: "#fff", accent: "#378ADD",
    fyBadgeBg: "#E6F1FB", fyBadgeText: "#0C447C",
    calcIconBg: "#E6F1FB", calcIconColor: "#185FA5",
    frankingBg: "#E1F5EE", frankingBorder: "#9FE1CB",
    frankingText: "#0F6E56", frankingMuted: "#1D9E75", frankingValue: "#0F6E56",
  };
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const { data: taxData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ["tax-overview", userId],
    queryFn:  () => getTaxOverview(userId),
    staleTime: 86_400_000, // 24 h — Group D engine
    enabled:  !authLoading && !!userId,
  });
  const error = queryError?.message || null;

  const cgtReports   = REPORTS.filter(r => ["cgt_events","cgt_summary","method_breakdown"].includes(r.id));
  const divReports   = REPORTS.filter(r => ["dividend_events","dividend_summary","remaining_parcels"].includes(r.id));
  const otherReports = REPORTS.filter(r =>
    !["cgt_events","cgt_summary","method_breakdown","dividend_events","dividend_summary","remaining_parcels","disposal_errors"].includes(r.id)
  );

  // Derived values (safe to compute even while loading — will be undefined/0 until data arrives)
  const cgt           = taxData?.cgtSummary ?? {};
  const div           = taxData?.dividendSummary ?? {};
  const meta          = taxData?.meta ?? {};
  const frankingRatio = div.total_grossed_up_income
    ? Math.round((div.total_franking_credits / div.total_grossed_up_income) * 100)
    : 0;

  const metricCards = [
    { label: "Net capital gain",  value: `$${(cgt.net_capital_gain ?? 0).toLocaleString()}`,                                                                        sub: "reportable to ATO",        color: "#E24B4A" },
    { label: "Gross gain",        value: `$${(cgt.total_gross_gains ?? 0).toLocaleString()}`,                                                                       sub: "before discount & losses", color: C.text   },
    { label: "Capital losses",    value: `$${(cgt.total_capital_losses ?? 0).toLocaleString()}`,                                                                    sub: "applied this year",        color: "#E24B4A" },
    { label: "Total dividends",   value: `$${(div.total_cash_dividends ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,    sub: "incl. franking credits",   color: "#1D9E75" },
  ];

  const r    = 18, circ = 2 * Math.PI * r;
  const frankingArc = (frankingRatio / 100) * circ;

  return (
    <>
      {/* Shimmer keyframe — injected once */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Breadcrumb */}
      <div className="tax-breadcrumb">
        <span>🏠</span>
        <span className="tax-breadcrumb__sep">›</span>
        <span className="tax-breadcrumb__current" style={{ color: C.text }}>Tax</span>
      </div>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 className="tax-landing__title" style={{ color: C.text, margin: 0 }}>Tax</h1>
        {/* FY badge */}
        {loading
          ? <Skeleton width={72} height={22} radius={20} />
          : (
            <span style={{
              fontSize: 12, background: C.fyBadgeBg, color: C.fyBadgeText,
              padding: "3px 10px", borderRadius: 20, fontWeight: 600,
            }}>
              {meta.financial_year ?? "—"}
            </span>
          )}
      </div>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        Manage your Australian tax obligations — CGT, dividends, and ATO reporting
      </p>

      {/* Error state */}
      {error && <ErrorBanner message={error} C={C} />}

      {/* CGT Calculator banner — always shown, no data needed */}
      <div style={{
        border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 24px",
        marginBottom: 16, background: C.thBg,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 20, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1, minWidth: 260 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: C.calcIconBg,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
              <rect x={2} y={2} width={14} height={14} rx={2} stroke={C.calcIconColor} strokeWidth={1.5}/>
              <path d="M5 9h8M9 5v8" stroke={C.calcIconColor} strokeWidth={1.5} strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              Australian Capital Gains Tax Calculator
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, maxWidth: 520 }}>
              Calculate your CGT liability per ATO rules. Experiment with FIFO, MinGain, and MaxGain
              allocation methods and export results as CSV, PDF or Google Sheets.
            </div>
          </div>
        </div>
        <button
          onClick={onCGT}
          style={{
            alignSelf: "center", padding: "10px 22px", borderRadius: 8,
            border: `1.5px solid ${C.accent}`, background: "transparent",
            color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", transition: "background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.accent; }}
        >
          Open CGT Calculator →
        </button>
      </div>

      {/* Franking Credit Meter */}
      <div style={{
        background: C.frankingBg, border: `0.5px solid ${C.frankingBorder}`,
        borderRadius: 12, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {loading ? (
            <Skeleton width={48} height={48} radius="50%" />
          ) : (
            <svg width={48} height={48} viewBox="0 0 48 48">
              <circle cx={24} cy={24} r={r} fill="none" stroke={C.frankingBorder} strokeWidth={5}/>
              <circle cx={24} cy={24} r={r} fill="none" stroke={C.frankingMuted} strokeWidth={5}
                strokeDasharray={`${frankingArc} ${circ}`} strokeDashoffset={28} strokeLinecap="round"/>
              <text x={24} y={28} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.frankingText}>
                {frankingRatio}%
              </text>
            </svg>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.frankingText }}>Franking Credit Meter</div>
            <div style={{ fontSize: 11, color: C.frankingMuted, marginTop: 2 }}>
              {loading
                ? <Skeleton width={240} height={12} />
                : `$${(div.total_franking_credits ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in franking credits available · ${meta.financial_year ?? ""}`
              }
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {loading ? (
            <>
              <Skeleton width={80} height={24} style={{ marginBottom: 6 }} />
              <Skeleton width={120} height={12} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.frankingValue }}>
                ${(div.total_franking_credits ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: C.frankingMuted }}>
                grossed-up: ${(div.total_grossed_up_income ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 24 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", background: C.bg }}>
                <Skeleton width="60%" height={12} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={24} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={11} />
              </div>
            ))
          : metricCards.map((m, i) => (
              <div key={i} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{m.sub}</div>
              </div>
            ))
        }
      </div>

      {/* Report card groups */}
      {[
        { label: "CGT reports",      reports: cgtReports },
        { label: "Dividend reports", reports: divReports },
        ...(otherReports.length ? [{ label: "Other", reports: otherReports }] : []),
      ].map(group => (
        <div key={group.label} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
            color: C.muted, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
          }}>
            {group.label}
          </div>

          <div className="tools-grid">
            {group.reports.map(r => (
              <ReportCard key={r.id} report={r} onClick={() => onSelect(r.id)} colors={C} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}