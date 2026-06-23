// CGT Calculator page

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { calculateCgt, getCurrentUserId } from "../../services/taxApi";
import { useAuth } from "../../contexts/AuthContext";

// ATO-approved allocation methods (was in cgtMockData.js)
const ATO_METHODS = [
  { id: "fifo",      label: "FIFO",      desc: "First In, First Out — oldest parcels sold first" },
  { id: "mintax",    label: "Min Tax",   desc: "Minimises your tax liability for this year" },
  { id: "maxrefund", label: "Max Refund",desc: "Maximises losses to carry forward" },
];

// Colour tokens
const GAIN_CLR = "#1D9E75";
const LOSS_CLR = "#E24B4A";
const BASE_CLR = "#378ADD";
const DISC_CLR = "#EF9F27";

// Helpers
const $  = (v) => `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Card({ children, style, C }) {
  return (
    <div style={{
      background: C?.bg || "#fff",
      border: `1px solid ${C?.border || "#E8E6E1"}`,
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardTitle({ children, C }) {
  return (
    <p style={{
      fontSize: 14, fontWeight: 700, color: C?.text || "#222",
      marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C?.border || "#F0EDE8"}`,
    }}>
      {children}
    </p>
  );
}

function SectionLabel({ children, C }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: C?.muted || "#999", marginBottom: 12,
    }}>
      {children}
    </p>
  );
}

// Left Panel: Parameters
function ParametersPanel({ dateRange, setDateRange, method, setMethod, carryForward, setCarryForward, marginalRate, setMarginalRate, onCalculate, C }) {
  const [advOpen, setAdvOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const fyOptions = [
    { label: `FY ${currentYear - 1}–${String(currentYear).slice(-2)} (1 Jul ${currentYear - 1} – 30 Jun ${currentYear})`, from: `${currentYear - 1}-07-01`, to: `${currentYear}-06-30` },
    { label: `FY ${currentYear - 2}–${String(currentYear - 1).slice(-2)}`, from: `${currentYear - 2}-07-01`, to: `${currentYear - 1}-06-30` },
    { label: `FY ${currentYear - 3}–${String(currentYear - 2).slice(-2)}`, from: `${currentYear - 3}-07-01`, to: `${currentYear - 2}-06-30` },
  ];

  const fieldLbl = {
    fontSize: 12, color: C?.muted || "#888", marginBottom: 5, display: "block",
    fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const inp = {
    width: "100%", fontSize: 13, padding: "7px 10px",
    border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8,
    background: C?.thBg || "#FAFAF8", color: C?.text || "#333", outline: "none",
  };

  return (
    <Card C={C} style={{ marginBottom: 0 }}>
      <CardTitle C={C}>Parameters</CardTitle>

      {/* Tax year */}
      <div style={{ marginBottom: 14 }}>
        <span style={fieldLbl}>Tax year</span>
        <select
          style={inp}
          onChange={e => {
            const opt = fyOptions[e.target.selectedIndex];
            setDateRange({ from: opt.from, to: opt.to });
          }}
        >
          {fyOptions.map(o => <option key={o.label}>{o.label}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <span style={fieldLbl}>From date</span>
          <input type="date" value={dateRange.from}
            onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
            style={inp} />
        </div>
        <div>
          <span style={fieldLbl}>To date</span>
          <input type="date" value={dateRange.to}
            onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
            style={inp} />
        </div>
      </div>

      {/* Portfolio */}
      <div style={{ marginBottom: 18 }}>
        <span style={fieldLbl}>Portfolio</span>
        <select style={inp}>
          <option>All holdings</option>
          <option>ASX holdings only</option>
          <option>NASDAQ holdings only</option>
        </select>
      </div>

      {/* Sale allocation method */}
      <div style={{ marginBottom: 4 }}>
        <span style={{ ...fieldLbl, marginBottom: 10, display: "block" }}>Sale allocation method</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ATO_METHODS.map(m => {
            const sel = method === m.id;
            return (
              <div key={m.id} onClick={() => setMethod(m.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px",
                border: `1px solid ${sel ? BASE_CLR : (C?.border || "#E8E6E1")}`,
                borderRadius: 8,
                background: sel ? (C?.accentTag || "#EBF4FF") : (C?.thBg || "#FAFAF8"),
                cursor: "pointer", transition: "all 0.15s",
              }}>
                {/* Radio dot */}
                <div style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: `1.5px solid ${sel ? BASE_CLR : "#ccc"}`,
                  background: sel ? BASE_CLR : (C?.thBg || "#fff"),
                }} />
                <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? BASE_CLR : "#333" }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 11, color: sel ? BASE_CLR : "#aaa", marginLeft: "auto" }}>
                  {m.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced options */}
      <button
        onClick={() => setAdvOpen(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: BASE_CLR, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 5,
          marginTop: 14, padding: 0,
        }}
      >
        <span style={{
          display: "inline-block", transition: "transform 0.2s",
          transform: advOpen ? "rotate(90deg)" : "rotate(0deg)",
        }}>▶</span>
        Advanced options
      </button>

      {advOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C?.border || "#F0EDE8"}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel C={C}>Advanced options</SectionLabel>
          <div>
            <span style={fieldLbl}>Prior-year carry-forward losses ($)</span>
            <input type="number" min={0} value={carryForward}
              onChange={e => setCarryForward(Number(e.target.value))}
              placeholder="0.00" style={inp} />
            <p style={{ fontSize: 11, color: C?.muted || "#aaa", marginTop: 4, lineHeight: 1.5 }}>
              Deducted from net capital gain before the CGT discount.
            </p>
          </div>
          <div>
            <span style={fieldLbl}>Marginal tax rate (%)</span>
            <input type="number" min={0} max={100} value={marginalRate}
              onChange={e => setMarginalRate(Number(e.target.value))}
              style={inp} />
          </div>
          <div>
            <span style={fieldLbl}>Include DRP parcels</span>
            <select style={inp}><option>Yes</option><option>No</option></select>
          </div>
        </div>
      )}

      {/* Calculate button */}
      <button
        onClick={onCalculate}
        style={{
          width: "100%", marginTop: 20, background: C?.text || "#111", color: C?.bg || "#fff",
          border: "none", borderRadius: 10, padding: "11px 0",
          fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "opacity 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
      >
        Calculate CGT →
      </button>
    </Card>
  );
}

// Right: KPI result cards
function ResultCards({ summary, marginalRate, method, C }) {
  const liability = Math.round(summary.net_capital_gain * (marginalRate / 100));
  const cards = [
    { label: "Total CGT liability",  value: $(liability),                           color: LOSS_CLR, sub: `at ${marginalRate}% marginal rate` },
    { label: "Net capital gain",     value: $(summary.net_capital_gain),            color: GAIN_CLR, sub: "after 50% discount" },
    { label: "Raw capital gain",     value: $(summary.total_gross_gains),           color: C?.text || "#333",   sub: "before discount" },
    { label: "Capital losses",       value: `−${$(summary.total_capital_losses)}`,  color: LOSS_CLR, sub: "applied this year" },
  ];

  return (
    <Card C={C}>
      <CardTitle C={C}>Results — {method.toUpperCase()} method</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: C?.thBg || "#FAFAF8", borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: C?.muted || "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: C?.muted || "#aaa", marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Right: Gain by method bar chart
function GainByMethodChart({ summary, C }) {
  const bars = [
    { label: "Discount", value: summary.total_net_gains_after_discount, color: "#B5D4F4" },
    { label: "Losses",   value: summary.total_capital_losses,           color: "#F09595" },
    { label: "Discount\napplied", value: summary.total_cgt_discount_applied, color: "#D3D1C7" },
  ];
  const maxVal = Math.max(...bars.map(b => b.value), 1);

  return (
    <Card C={C}>
      <CardTitle C={C}>Gain by method</CardTitle>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, padding: "0 4px" }}>
        {bars.map((b, i) => {
          const pct = Math.round((b.value / maxVal) * 100);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, height: "100%" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C?.text || "#333" }}>{$(b.value)}</div>
              <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                <div style={{
                  width: "100%", height: `${pct}%`, minHeight: 4,
                  background: b.color, borderRadius: "3px 3px 0 0",
                  transition: "height 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: 10, color: C?.muted || "#aaa", textAlign: "center", whiteSpace: "pre" }}>{b.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Right: Breakdown table
function BreakdownTable({ events, C }) {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [sortKey, setSortKey]           = useState(null);
  const [sortDir, setSortDir]           = useState(1);

  const symbols = [...new Set(events.map(e => e.symbol))].sort();
  const methods = [...new Set(events.map(e => e.cgt_method))].sort();

  const filtered = useMemo(() => {
    let d = [...events];
    if (symbolFilter) d = d.filter(e => e.symbol === symbolFilter);
    if (methodFilter) d = d.filter(e => e.cgt_method === methodFilter);
    if (sortKey) d.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });
    return d;
  }, [events, symbolFilter, methodFilter, sortKey, sortDir]);

  const totProceeds = filtered.reduce((s, e) => s + e.proceeds, 0);
  const totCost     = filtered.reduce((s, e) => s + e.cost_base, 0);
  const totNet      = filtered.reduce((s, e) => s + (e.is_loss ? -e.capital_loss : e.net_gain), 0);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1);
    else { setSortKey(key); setSortDir(1); }
  };

  const sortArrow = (key) => {
    if (sortKey !== key) return <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span>;
    return <span style={{ marginLeft: 3, color: BASE_CLR }}>{sortDir === 1 ? "↑" : "↓"}</span>;
  };

  const inp = {
    fontSize: 12, padding: "5px 9px", height: 30,
    border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 6,
    background: C?.thBg || "#FAFAF8", color: C?.text || "#333", outline: "none",
  };

  const methodTag = (m) => {
    const map = {
      discount: { bg: C?.accentTag || "#E6F1FB", color: C?.accentTagText || "#0C447C" },
      loss:     { bg: C?.lossTag || "#FCEBEB", color: C?.lossTagText || "#A32D2D" },
      indexed:  { bg: C?.frankingBg || "#E8F5F0", color: C?.frankingText || "#085041" },
    };
    const s = map[m] || { bg: C?.mutedTag || "#F0F0F0", color: C?.mutedTagText || "#555" };
    return (
      <span style={{
        display: "inline-block", fontSize: 10, padding: "2px 8px",
        borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color,
      }}>{m}</span>
    );
  };

  const cols = [
    { key: "symbol",     label: "Stock",    right: false },
    { key: "cgt_method", label: "Method",   right: false },
    { key: "proceeds",   label: "Proceeds", right: true },
    { key: "cost_base",  label: "Cost base",right: true },
    { key: "net_gain",   label: "Net gain", right: true },
  ];

  const thStyle = {
    padding: "8px 12px", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em", color: C?.muted || "#999",
    borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none", background: C?.thBg || "#FAFAF8",
  };

  return (
    <Card C={C}>
      <CardTitle C={C}>Breakdown by holding</CardTitle>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)} style={inp}>
          <option value="">All stocks</option>
          {symbols.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={inp}>
          <option value="">All methods</option>
          {methods.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {(symbolFilter || methodFilter) && (
          <button onClick={() => { setSymbolFilter(""); setMethodFilter(""); }}
            style={{ ...inp, cursor: "pointer", background: "transparent", color: C?.muted || "#999" }}>
            Reset
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C?.muted || "#aaa" }}>
          {filtered.length} of {events.length} events
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  style={{ ...thStyle, textAlign: c.right ? "right" : "left" }}>
                  {c.label}{sortArrow(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const netVal = row.is_loss ? -row.capital_loss : row.net_gain;
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : (C?.thBg || "#FAFAF8") }}>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#F0EDE8"}`, fontWeight: 600, color: C?.text || "#222" }}>{row.symbol}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#F0EDE8"}` }}>{methodTag(row.cgt_method)}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#F0EDE8"}`, textAlign: "right", color: C?.textSub || "#555" }}>{$(row.proceeds)}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#F0EDE8"}`, textAlign: "right", color: C?.textSub || "#555" }}>{$(row.cost_base)}</td>
                  <td style={{ padding: "9px 12px", borderBottom: "1px solid #F0EDE8", textAlign: "right", fontWeight: 600, color: netVal >= 0 ? GAIN_CLR : LOSS_CLR }}>
                    {netVal >= 0 ? "+" : "−"}{$(Math.abs(netVal))}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>
              <td colSpan={2} style={{ padding: "9px 12px", color: C?.text || "#333" }}>
                Total ({filtered.length} events)
              </td>
              <td style={{ padding: "9px 12px", textAlign: "right", color: C?.textSub || "#555" }}>{$(totProceeds)}</td>
              <td style={{ padding: "9px 12px", textAlign: "right", color: C?.textSub || "#555" }}>{$(totCost)}</td>
              <td style={{ padding: "9px 12px", textAlign: "right", color: totNet >= 0 ? GAIN_CLR : LOSS_CLR }}>
                {totNet >= 0 ? "+" : "−"}{$(Math.abs(totNet))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Export bar
function ExportBar({ events, summary, method, dateRange, C }) {
  const filename = `CGT_${method.toUpperCase()}_${dateRange.from}_${dateRange.to}`;

  const exportCSV = useCallback(() => {
    const cols = Object.keys(events[0]);
    const rows = [cols.join(","), ...events.map(e => cols.map(c => JSON.stringify(e[c] ?? "")).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [events, filename]);

  const exportPDF = useCallback(() => {
    const rows = events.map(e =>
      `<tr>${["symbol","disposal_date","cost_base","proceeds","raw_gain","cgt_method","net_gain"].map(k =>
        `<td style="padding:6px 10px;border-bottom:1px solid #eee">${e[k]}</td>`
      ).join("")}</tr>`
    ).join("");
    const html = `
      <html><head><title>${filename}</title>
      <style>body{font-family:sans-serif;padding:32px;color:#222}h1{font-size:20px;margin-bottom:4px}
      p{font-size:13px;color:#666;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f5f5f5;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#666}
      .kpi{display:flex;gap:24px;margin-bottom:24px;flex-wrap:wrap}
      .kpi-item{background:#f9f9f9;border-radius:8px;padding:12px 16px;min-width:140px}
      .kpi-label{font-size:11px;color:#888;margin-bottom:4px}.kpi-value{font-size:18px;font-weight:700}
      </style></head><body>
      <h1>CGT Report — ${method.toUpperCase()} method</h1>
      <p>Period: ${dateRange.from} to ${dateRange.to} | Generated ${new Date().toLocaleDateString("en-AU")}</p>
      <div class="kpi">
        <div class="kpi-item"><div class="kpi-label">Net capital gain</div><div class="kpi-value" style="color:${GAIN_CLR}">$${summary.net_capital_gain.toLocaleString()}</div></div>
        <div class="kpi-item"><div class="kpi-label">Total gross gains</div><div class="kpi-value">$${summary.total_gross_gains.toLocaleString()}</div></div>
        <div class="kpi-item"><div class="kpi-label">Discount applied</div><div class="kpi-value">$${summary.total_cgt_discount_applied.toLocaleString()}</div></div>
        <div class="kpi-item"><div class="kpi-label">Capital losses</div><div class="kpi-value" style="color:${LOSS_CLR}">$${summary.total_capital_losses.toLocaleString()}</div></div>
      </div>
      <table><thead><tr>
        ${["Symbol","Disposal date","Cost base","Proceeds","Raw gain","Method","Net gain"].map(h => `<th>${h}</th>`).join("")}
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }, [events, summary, method, dateRange, filename]);

  const exportGSheets = useCallback(() => {
    const cols = Object.keys(events[0]);
    const rows = [cols.join(","), ...events.map(e => cols.map(c => e[c] ?? "").join(","))].join("\n");
    const url = `https://docs.google.com/spreadsheets/d/create?title=${encodeURIComponent(filename)}`;
    window.open(url, "_blank");
    navigator.clipboard.writeText(rows).catch(() => {});
    alert("Google Sheets opened. CSV data copied to clipboard — paste via File → Import.");
  }, [events, filename]);

  const btnStyle = (color) => ({
    flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 500,
    border: `1px solid ${color}`, borderRadius: 8, color,
    background: "transparent", cursor: "pointer", transition: "background .15s",
    textAlign: "center",
  });

  return (
    <Card C={C} style={{ padding: "14px 20px" }}>
      <p style={{ fontSize: 12, color: C?.muted || "#aaa", marginBottom: 10 }}>Export results as</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={btnStyle(BASE_CLR)} onClick={exportCSV}
          onMouseEnter={e => e.currentTarget.style.background = "#EBF4FF"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↓ CSV</button>
        <button style={btnStyle(LOSS_CLR)} onClick={exportPDF}
          onMouseEnter={e => e.currentTarget.style.background = "#FEF1F1"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↓ PDF</button>
        <button style={btnStyle(GAIN_CLR)} onClick={exportGSheets}
          onMouseEnter={e => e.currentTarget.style.background = "#E8F7F2"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>↗ Google Sheets</button>
      </div>
    </Card>
  );
}

// Main CGTPage
export default function CGTPage({ C, onBack }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const currentYear = new Date().getFullYear();
  const [dateRange, setDateRange]       = useState({ from: `${currentYear - 1}-07-01`, to: `${currentYear}-06-30` });
  const [method, setMethod]             = useState("fifo");
  const [carryForward, setCarryForward] = useState(0);
  const [marginalRate, setMarginalRate] = useState(37);
  const [cgt_events,  setCgtEvents]   = useState([]);
  const [cgt_summary, setCgtSummary]  = useState(null);

  const { mutate: triggerCalc, isPending: calculating, error: calcErr } = useMutation({
    mutationFn: (params) => calculateCgt(params),
    onSuccess:  (result) => {
      setCgtEvents(result.cgt_events   ?? []);
      setCgtSummary(result.cgt_summary ?? null);
    },
    onError: () => {
      // TODO: remove demo fallback when backend /api/tax/cgt-calculate is stable
      const demoEvents = [
        { parcel_id: "p-001", symbol: "CBA", disposal_date: dateRange.to, units_disposed: 100, cost_base: 7300, proceeds: 8200, cgt_method: "discount", raw_gain: 900, discount_applied: 450, net_gain: 450, capital_loss: 0, is_loss: false },
        { parcel_id: "p-002", symbol: "BHP", disposal_date: dateRange.to, units_disposed: 50,  cost_base: 2625, proceeds: 3100, cgt_method: "discount", raw_gain: 475, discount_applied: 237, net_gain: 238, capital_loss: 0, is_loss: false },
        { parcel_id: "p-003", symbol: "WBC", disposal_date: dateRange.to, units_disposed: 200, cost_base: 6200, proceeds: 5800, cgt_method: "loss",     raw_gain: 0,   discount_applied: 0,   net_gain: 0,   capital_loss: 400, is_loss: true  },
        { parcel_id: "p-004", symbol: "TLS", disposal_date: dateRange.to, units_disposed: 500, cost_base: 1950, proceeds: 1800, cgt_method: "loss",     raw_gain: 0,   discount_applied: 0,   net_gain: 0,   capital_loss: 150, is_loss: true  },
      ];
      const demoSummary = {
        total_gross_gains: 1375, total_cgt_discount_applied: 687,
        total_net_gains_after_discount: 688, total_capital_losses: 550,
        prior_year_carried_forward_loss_applied: Number(carryForward) || 0,
        net_capital_gain: Math.max(0, 688 - 550 - (Number(carryForward) || 0)),
      };
      setCgtEvents(demoEvents);
      setCgtSummary(demoSummary);
    },
  });
  const calcError = calcErr?.message || null;

  const runCalculation = useCallback(() => {
    if (!userId) return;
    triggerCalc({ user_id: userId, method, carry_forward: Number(carryForward), date_from: dateRange.from, date_to: dateRange.to });
  }, [userId, method, carryForward, dateRange, triggerCalc]);

  // Auto-calculate once auth is ready
  useEffect(() => {
    if (authLoading || !userId) return;
    runCalculation();
  }, [authLoading, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventsToShow = useMemo(() => {
    const filtered = cgt_events.filter(e =>
      e.disposal_date >= dateRange.from && e.disposal_date <= dateRange.to
    );
    return filtered.length ? filtered : cgt_events;
  }, [cgt_events, dateRange]);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: C?.text || "#222", paddingBottom: 48 }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C?.muted || "#aaa", marginBottom: 20 }}>
        <span>🏠</span>
        <span>›</span>
        <span style={{ color: BASE_CLR, cursor: "pointer", fontWeight: 500 }} onClick={onBack}>Tax</span>
        <span>›</span>
        <span style={{ color: C?.text || "#333" }}>CGT Calculator</span>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C?.text || "#111", marginBottom: 6, letterSpacing: "-0.02em" }}>
          CGT Calculator
        </h1>
        <p style={{ fontSize: 14, color: C?.muted || "#888", maxWidth: 600, lineHeight: 1.6 }}>
          Calculate your Australian capital gains tax liability per ATO rules.
          Adjust the sale allocation method to optimise your position.
        </p>
      </div>

      {/* Two-column layout — matches HTML mockup */}
      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: 20, alignItems: "start" }}>

        {/* Left: Parameters */}
        <ParametersPanel
          C={C}
          dateRange={dateRange}
          setDateRange={setDateRange}
          method={method}
          setMethod={setMethod}
          carryForward={carryForward}
          setCarryForward={setCarryForward}
          marginalRate={marginalRate}
          setMarginalRate={setMarginalRate}
          onCalculate={runCalculation}
        />

        {/* Right: Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Error banner — only show if we have no fallback data */}
          {calcError && !cgt_summary && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #F09595", borderRadius: 10,
              padding: "12px 16px", marginBottom: 16, color: "#B91C1C", fontSize: 13,
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <span>⚠️</span> {calcError}
            </div>
          )}

          {/* Loading overlay */}
          {calculating && !cgt_summary && (
            <div style={{
              background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 12,
              padding: "48px 0", textAlign: "center", color: C?.muted || "#aaa", fontSize: 13,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
              Calculating via ATO rules…
            </div>
          )}

          {cgt_summary && (
            <>
              <ResultCards summary={cgt_summary} marginalRate={marginalRate} method={method} C={C} />
              <GainByMethodChart summary={cgt_summary} C={C} />
              <BreakdownTable events={eventsToShow} C={C} />
              <ExportBar events={eventsToShow} summary={cgt_summary} method={method} dateRange={dateRange} C={C} />

            </> 
          )}

          {/* ATO notice */}
          <div style={{
            fontSize: 11, color: C?.muted || "#aaa", background: C?.thBg || "#FAFAF8",
            border: `1px solid ${C?.border || "#F0EDE8"}`, borderRadius: 8,
            padding: "10px 14px", lineHeight: 1.6,
          }}>
            Calculations follow ATO CGT rules for Australian residents. Results are estimates only
            and may differ from your tax return. Consult a registered tax agent for advice.
          </div>
        </div>

      </div>
    </div>
  );
}