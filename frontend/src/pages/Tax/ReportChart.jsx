import React, { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList } from "recharts";


// Colour tokens
const GAIN_CLR = "#1D9E75";
const LOSS_CLR = "#E24B4A";
const BLUE_LT  = "#B5D4F4";
const GREEN_LT = "#9FE1CB";
const GREEN_BG = "#E1F5EE";
const RED_LT   = "#F09595";
const AMBER_LT = "#FAC775";

// Helpers
const fmt  = (v) => `$${Math.abs(Number(v ?? 0)).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmt2 = (v) => `$${Math.abs(Number(v ?? 0)).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// FY label map — value from TaxReport dropdown → display string used in chart titles/tags
const FY_LABEL = {
  FY2025: "FY 2024–25",
  FY2024: "FY 2023–24",
  FY2023: "FY 2022–23",
};

// Shared atoms
function MetricCard({ label, value, sub, color, C }) {
  return (
    <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: C?.muted || "#999", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || C?.text || "#222" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C?.muted || "#999", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CardBox({ children, style, C }) {
  return (
    <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, padding: "18px 20px", ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children, C }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: C?.text || "#222", marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${C?.border || "#E8E6E1"}` }}>
      {children}
    </div>
  );
}

function Tag({ bg, color, children }) {
  return (
    <span style={{ display: "inline-block", fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 600, background: bg, color }}>
      {children}
    </span>
  );
}

function FilterSel({ value, onChange, children, C }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ fontSize: 12, padding: "6px 10px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: C?.bg || "#fff", color: C?.text || "#222", outline: "none", minWidth: 120, cursor: "pointer" }}>
      {children}
    </select>
  );
}

function DateInput({ value, onChange, C }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ fontSize: 12, padding: "6px 10px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: C?.bg || "#fff", color: C?.text || "#222", outline: "none", width: 130 }} />
  );
}

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv  = [keys.join(","), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const a    = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })),
    download: filename,
  });
  a.click();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CGT EVENTS
// JSON fields: parcel_id, disposal_date, symbol, units_disposed, cost_base,
//   proceeds, cgt_method ("discount"|"loss"), raw_gain, discount_applied,
//   net_gain, capital_loss, is_loss
// ═══════════════════════════════════════════════════════════════════════════════
function CgtEventsChart({ data, C, selectedFY }) {
  const allEvents = Array.isArray(data) ? data : [];

  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [stockFilter,  setStockFilter]  = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [sortCol,      setSortCol]      = useState("disposal_date");
  const [sortAsc,      setSortAsc]      = useState(true);

  const symbols = useMemo(() => [...new Set(allEvents.map(e => e.symbol))].sort(), [allEvents]);
  const methods = useMemo(() => [...new Set(allEvents.map(e => e.cgt_method))].sort(), [allEvents]);

  const visible = useMemo(() => {
    let r = [...allEvents];
    if (dateFrom)     r = r.filter(e => e.disposal_date >= dateFrom);
    if (dateTo)       r = r.filter(e => e.disposal_date <= dateTo);
    if (stockFilter)  r = r.filter(e => e.symbol === stockFilter);
    if (methodFilter) r = r.filter(e => e.cgt_method === methodFilter);
    if (resultFilter === "gain") r = r.filter(e => !e.is_loss);
    if (resultFilter === "loss") r = r.filter(e => e.is_loss);
    r.sort((a, b) => {
      const av = a[sortCol] ?? "", bv = b[sortCol] ?? "";
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
    return r;
  }, [allEvents, dateFrom, dateTo, stockFilter, methodFilter, resultFilter, sortCol, sortAsc]);

  const hasFilter = dateFrom || dateTo || stockFilter || methodFilter || resultFilter;
  const reset = () => { setDateFrom(""); setDateTo(""); setStockFilter(""); setMethodFilter(""); setResultFilter(""); };

  const totProc = visible.reduce((s, e) => s + Number(e.proceeds    ?? 0), 0);
  const totCost = visible.reduce((s, e) => s + Number(e.cost_base   ?? 0), 0);
  const totRaw  = visible.reduce((s, e) => s + Number(e.raw_gain    ?? 0), 0);
  const totNet  = visible.reduce((s, e) => s + (e.is_loss ? -Number(e.capital_loss ?? 0) : Number(e.net_gain ?? 0)), 0);

  const handleSort = (col) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
  const th = { padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8", userSelect: "none", cursor: "pointer" };
  const td = { padding: "10px 12px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  const SortTh = ({ col, label, right }) => (
    <th onClick={() => handleSort(col)} style={{ ...th, textAlign: right ? "right" : "left", color: sortCol === col ? GAIN_CLR : C?.muted || "#999" }}>
      {label} {sortCol === col ? (sortAsc ? "↑" : "↓") : <span style={{ opacity: 0.3 }}>↕</span>}
    </th>
  );

  const methodTag = (m) => m === "discount"
    ? { bg: C?.accentTag || "#E6F1FB", color: C?.accentTagText || "#0C447C" }
    : { bg: C?.mutedTag  || "#F1EFE8", color: C?.mutedTagText  || "#5F5E5A" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total events"     value={visible.length}  sub="disposals this year"    color={C?.text}                            C={C} />
        <MetricCard label="Total proceeds"   value={fmt(totProc)}    sub="across all parcels"     color={C?.text}                            C={C} />
        <MetricCard label="Net capital gain" value={`${totRaw >= 0 ? "+" : "−"}${fmt(Math.abs(totRaw))}`} sub="raw gain / loss" color={totRaw >= 0 ? GAIN_CLR : LOSS_CLR} C={C} />
        <MetricCard label="Discounted gain"  value={`${totNet >= 0 ? "+" : "−"}${fmt(Math.abs(totNet))}`} sub="after CGT discount" color={totNet >= 0 ? GAIN_CLR : LOSS_CLR} C={C} />
      </div>

      <CardBox C={C} style={{ marginBottom: 16 }}>
        <CardTitle C={C}>Gain / loss by stock — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
        {(() => {
          const byStock = {};
          visible.forEach(e => {
            if (!byStock[e.symbol]) byStock[e.symbol] = { Gain: 0, Loss: 0, count: 0 };
            const val = Math.abs(Number(e.raw_gain ?? 0));
            if (e.is_loss) byStock[e.symbol].Loss += val;
            else byStock[e.symbol].Gain += val;
            byStock[e.symbol].count++;
          });
          const chartData = Object.entries(byStock).map(([symbol, v]) => ({
            symbol, Gain: Math.round(v.Gain), Loss: Math.round(v.Loss),
            net: Math.round(v.Gain - v.Loss), count: v.count,
          }));
          const CgtTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = chartData.find(r => r.symbol === label) || {};
            return (
              <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                <div style={{ fontWeight: 700, color: C?.text || "#222", marginBottom: 6 }}>
                  {label} <span style={{ fontWeight: 400, color: C?.muted || "#999" }}>· {d.count} event{d.count !== 1 ? "s" : ""}</span>
                </div>
                {d.Gain > 0 && <div style={{ color: GAIN_CLR, marginBottom: 2 }}>Gains: +${d.Gain.toLocaleString()}</div>}
                {d.Loss > 0 && <div style={{ color: LOSS_CLR, marginBottom: 2 }}>Losses: −${d.Loss.toLocaleString()}</div>}
                <div style={{ borderTop: `1px solid ${C?.border || "#E8E6E1"}`, marginTop: 6, paddingTop: 6, fontWeight: 600, color: d.net >= 0 ? GAIN_CLR : LOSS_CLR }}>
                  Net: {d.net >= 0 ? "+" : "−"}${Math.abs(d.net).toLocaleString()}
                </div>
              </div>
            );
          };
          if (chartData.length === 0) return <div style={{ padding: "24px 0", textAlign: "center", color: C?.muted || "#999", fontSize: 12 }}>No data</div>;
          return (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={3} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C?.border || "#E8E6E1"} vertical={false} />
                <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: C?.muted || "#999" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} tick={{ fontSize: 10, fill: C?.muted || "#999" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<CgtTooltip />} cursor={{ fill: C?.thBg || "#F5F5F3", radius: 4 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={10} />
                <Bar dataKey="Gain" fill={BLUE_LT} radius={[4,4,0,0]} maxBarSize={44}>
                  <LabelList dataKey="Gain" position="top" formatter={v => v > 0 ? `+$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}` : ""} style={{ fontSize: 9, fill: "#185FA5", fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="Loss" fill={RED_LT} radius={[4,4,0,0]} maxBarSize={44}>
                  <LabelList dataKey="Loss" position="top" formatter={v => v > 0 ? `−$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}` : ""} style={{ fontSize: 9, fill: LOSS_CLR, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </CardBox>

      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C?.muted || "#999" }}>From</span>
          <DateInput value={dateFrom} onChange={setDateFrom} C={C} />
          <span style={{ fontSize: 11, color: C?.muted || "#999" }}>To</span>
          <DateInput value={dateTo}   onChange={setDateTo}   C={C} />
          <FilterSel value={stockFilter}  onChange={setStockFilter}  C={C}>
            <option value="">All stocks</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSel>
          <FilterSel value={methodFilter} onChange={setMethodFilter} C={C}>
            <option value="">All methods</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </FilterSel>
          <FilterSel value={resultFilter} onChange={setResultFilter} C={C}>
            <option value="">Gain &amp; loss</option>
            <option value="gain">Gains only</option>
            <option value="loss">Losses only</option>
          </FilterSel>
          <span style={{ fontSize: 11, color: C?.muted || "#999", marginLeft: "auto" }}>{visible.length} record{visible.length !== 1 ? "s" : ""}</span>
          {hasFilter && <button onClick={reset} style={{ fontSize: 11, color: C?.accent || "#378ADD", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset</button>}
          <button onClick={() => exportCSV(visible, `cgt_events_${selectedFY}.csv`)}
            style={{ fontSize: 11, padding: "5px 12px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: "transparent", color: C?.text || "#333", cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <SortTh col="disposal_date"  label="Disposal date" />
                <SortTh col="symbol"         label="Stock" />
                <SortTh col="units_disposed" label="QTY"       right />
                <SortTh col="cost_base"      label="Cost base" right />
                <SortTh col="proceeds"       label="Proceeds"  right />
                <th style={{ ...th, textAlign: "left" }}>CGT method</th>
                <SortTh col="raw_gain"       label="Raw gain"  right />
                <th style={{ ...th, textAlign: "right" }}>Discount</th>
                <th style={{ ...th, textAlign: "right" }}>Net gain</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0
                ? <tr><td colSpan={9} style={{ ...td, textAlign: "center", padding: "32px 16px", color: C?.muted || "#999" }}>No records match the current filters.</td></tr>
                : visible.map((e, i) => {
                    const rawGain = Number(e.raw_gain ?? 0);
                    const netVal  = e.is_loss ? -Number(e.capital_loss ?? 0) : Number(e.net_gain ?? 0);
                    const ms      = methodTag(e.cgt_method);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                        <td style={td}>{fmtDate(e.disposal_date)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{e.symbol}</td>
                        <td style={{ ...td, textAlign: "right" }}>{e.units_disposed}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(e.cost_base)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(e.proceeds)}</td>
                        <td style={td}><Tag bg={ms.bg} color={ms.color}>{e.cgt_method}</Tag></td>
                        <td style={{ ...td, textAlign: "right", color: rawGain >= 0 ? GAIN_CLR : LOSS_CLR, fontWeight: 600 }}>
                          {rawGain >= 0 ? "+" : "−"}{fmt(Math.abs(rawGain))}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: C?.muted || "#999" }}>
                          {Number(e.discount_applied ?? 0) > 0 ? `−${fmt(e.discount_applied)}` : "n/a"}
                        </td>
                        <td style={{ ...td, textAlign: "right", color: netVal >= 0 ? GAIN_CLR : LOSS_CLR, fontWeight: 600 }}>
                          {netVal >= 0 ? "+" : "−"}{fmt(Math.abs(netVal))}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
                  <td colSpan={3} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Total ({visible.length} events)</td>
                  <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(totCost)}</td>
                  <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(totProc)}</td>
                  <td style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }} />
                  <td style={{ ...td, textAlign: "right", color: totRaw >= 0 ? GAIN_CLR : LOSS_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>
                    {totRaw >= 0 ? "+" : "−"}{fmt(Math.abs(totRaw))}
                  </td>
                  <td style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }} />
                  <td style={{ ...td, textAlign: "right", color: totNet >= 0 ? GAIN_CLR : LOSS_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>
                    {totNet >= 0 ? "+" : "−"}{fmt(Math.abs(totNet))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CGT SUMMARY
// JSON fields: total_gross_gains, total_cgt_discount_applied,
//   total_net_gains_after_discount, total_capital_losses,
//   prior_year_carried_forward_loss_applied, net_capital_gain
// ═══════════════════════════════════════════════════════════════════════════════
function CgtSummaryChart({ data, C, selectedFY, cgtEvents = [] }) {
  const cgt         = data ?? {};
  const gross       = Number(cgt.total_gross_gains ?? 0);
  const discount    = Number(cgt.total_cgt_discount_applied ?? 0);
  const losses      = Number(cgt.total_capital_losses ?? 0);
  const priorLoss   = Number(cgt.prior_year_carried_forward_loss_applied ?? 0);
  const netGain     = Number(cgt.net_capital_gain ?? 0);
  const netAfterDisc= Number(cgt.total_net_gains_after_discount ?? 0);

  const donutData = [
    { name: "Net after discount", value: netAfterDisc, color: BLUE_LT  },
    { name: "Discount applied",   value: discount,     color: AMBER_LT },
    { name: "Capital losses",     value: losses,       color: LOSS_CLR },
  ].filter(d => d.value > 0);

  const waterfall = [
    { label: "Gross capital gains",      val: gross,     pct: 100, color: BLUE_LT,  sign: "+" },
    { label: "Current year losses",      val: losses,    pct: gross > 0 ? Math.round(losses   / gross * 100) : 0, color: RED_LT,   sign: "−" },
    { label: "50% CGT discount",         val: discount,  pct: gross > 0 ? Math.round(discount / gross * 100) : 0, color: RED_LT,   sign: "−" },
    { label: "Prior-year carry-forward", val: priorLoss, pct: 0,   color: RED_LT,   sign: "−" },
    { label: "Net capital gain",         val: netGain,   pct: gross > 0 ? Math.round(netGain  / gross * 100) : 0, color: GAIN_CLR, sign: "+", total: true },
  ];

  const th = { padding: "9px 18px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8" };
  const td = { padding: "10px 18px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Net capital gain"  value={fmt(netGain)}        sub="reportable to ATO"        color={netGain >= 0 ? GAIN_CLR : LOSS_CLR} C={C} />
        <MetricCard label="Total gross gain"  value={fmt(gross)}          sub="before discount & losses" color={C?.text}                            C={C} />
        <MetricCard label="Discount applied"  value={`−${fmt(discount)}`} sub="50% CGT discount"         color={LOSS_CLR}                           C={C} />
        <MetricCard label="Losses offset"     value={`−${fmt(losses)}`}   sub="current year losses"      color={LOSS_CLR}                           C={C} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <CardBox C={C}>
          <CardTitle C={C}>Gain composition — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={30} outerRadius={46} dataKey="value" labelLine={false}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {donutData.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C?.muted || "#999", flex: 1 }}>{d.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C?.text || "#222" }}>{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardBox>

        <CardBox C={C}>
          <CardTitle C={C}>How your net gain is calculated</CardTitle>
          {waterfall.map((row, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: row.total ? "10px 0" : "8px 0",
              borderBottom: i < waterfall.length - 1 ? `0.5px solid ${C?.border || "#E8E6E1"}` : "none",
              fontWeight: row.total ? 700 : 400,
            }}>
              <span style={{ fontSize: 12, color: row.total ? C?.text || "#222" : C?.muted || "#999", width: 160, flexShrink: 0 }}>{row.label}</span>
              <div style={{ flex: 1, height: 18, background: C?.thBg || "#F5F5F3", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${row.pct}%`, minWidth: row.val > 0 ? 2 : 0, height: "100%", background: row.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: row.sign === "+" ? GAIN_CLR : LOSS_CLR, width: 64, textAlign: "right", whiteSpace: "nowrap" }}>
                {row.sign}{fmt(row.val)}
              </span>
            </div>
          ))}
        </CardBox>
      </div>

      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C?.text || "#222" }}>ATO Schedule 3 — capital gains tax summary</span>
          <Tag bg={C?.accentTag || "#E6F1FB"} color={C?.accentTagText || "#0C447C"}>{FY_LABEL[selectedFY] ?? selectedFY}</Tag>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", width: "40%" }}>Description</th>
                <th style={{ ...th, textAlign: "left" }}>Method</th>
                <th style={{ ...th, textAlign: "right" }}>Gross gain</th>
                <th style={{ ...th, textAlign: "right" }}>Discount</th>
                <th style={{ ...th, textAlign: "right" }}>Net gain</th>
              </tr>
            </thead>
            <tbody>
              {cgtEvents.map((e, i) => {
                const netVal  = e.is_loss ? -Number(e.capital_loss ?? 0) : Number(e.net_gain ?? 0);
                const rawGain = Number(e.raw_gain ?? 0);
                const ms = e.cgt_method === "discount" ? { bg: C?.accentTag || "#E6F1FB", color: C?.accentTagText || "#0C447C" } : { bg: C?.mutedTag || "#F1EFE8", color: C?.mutedTagText || "#5F5E5A" };
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{e.symbol} — {e.units_disposed} units · {fmtDate(e.disposal_date)}</td>
                    <td style={td}><Tag bg={ms.bg} color={ms.color}>{e.cgt_method}</Tag></td>
                    <td style={{ ...td, textAlign: "right", color: rawGain >= 0 ? GAIN_CLR : LOSS_CLR }}>
                      {rawGain >= 0 ? "+" : "−"}{fmt(Math.abs(rawGain))}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: C?.muted || "#999" }}>
                      {Number(e.discount_applied ?? 0) > 0 ? `−${fmt(e.discount_applied)}` : "n/a"}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: netVal >= 0 ? GAIN_CLR : LOSS_CLR, fontWeight: 600 }}>
                      {netVal >= 0 ? "+" : "−"}{fmt(Math.abs(netVal))}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
                <td colSpan={4} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Net capital gain — reportable at Item 18</td>
                <td style={{ ...td, textAlign: "right", color: GAIN_CLR, fontSize: 14, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(netGain)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <CardBox C={C}>
          <CardTitle C={C}>Export</CardTitle>
          <div style={{ display: "flex", gap: 8 }}>
            {["CSV", "PDF report"].map(l => (
              <div key={l} style={{ flex: 1, padding: 8, fontSize: 12, border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, textAlign: "center", cursor: "pointer", color: C?.text || "#333" }}>{l}</div>
            ))}
          </div>
        </CardBox>
        <CardBox C={C}>
          <CardTitle C={C}>ATO filing note</CardTitle>
          <p style={{ fontSize: 11, color: C?.muted || "#999", lineHeight: 1.6 }}>
            Report your net capital gain of <strong style={{ color: C?.text || "#222" }}>{fmt(netGain)}</strong> at{" "}
            <strong style={{ color: C?.text || "#222" }}>Item 18</strong> of your Individual Tax Return (myTax).
            Calculations are estimates — consult a registered tax agent.
          </p>
        </CardBox>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. METHOD BREAKDOWN
// JSON keys: method_breakdown.discount.{ event_count, total_net_gain,
//   total_capital_loss, total_discount_applied }
//            method_breakdown.loss.{ same keys }
// ═══════════════════════════════════════════════════════════════════════════════
function MethodBreakdownChart({ data, C, selectedFY, cgtEvents = [] }) {
  const mb   = data ?? {};
  const disc = mb.discount ?? {};   // key = "discount" ✓
  const loss = mb.loss     ?? {};   // key = "loss" ✓ (not "other")

  const bySymbol = useMemo(() => {
    const map = {};
    cgtEvents.forEach(e => {
      if (!map[e.symbol]) map[e.symbol] = { symbol: e.symbol, gross: 0, discount: 0, net: 0, method: e.cgt_method };
      map[e.symbol].gross    += Number(e.raw_gain ?? 0);
      map[e.symbol].discount += Number(e.discount_applied ?? 0);
      map[e.symbol].net      += e.is_loss ? -Number(e.capital_loss ?? 0) : Number(e.net_gain ?? 0);
      map[e.symbol].method    = e.cgt_method;
    });
    return Object.values(map);
  }, []);

  const maxAbs   = Math.max(...bySymbol.map(r => Math.abs(r.gross)), 1);
  const totalNet = Number(disc.total_net_gain ?? 0) - Number(loss.total_capital_loss ?? 0);

  const isDark = C?.bg === "#2a2a2a" || (C?.text || "").startsWith("#f");
  const methodBlocks = isDark
    ? [
        { label: "Discount method",   desc: "For assets held over 12 months. A 50% CGT discount applies to individuals. Most common for long-term share investors.",        bg: "#1a2e45", border: "#2d4d6e", nameColor: "#4d9ef5", descColor: "#7bbdd4" },
        { label: "Indexation method", desc: "For assets acquired before 21 Sep 1999. Cost base is indexed to CPI. Cannot use the 50% discount.",                           bg: "#1a2a10", border: "#3a5a20", nameColor: "#7ec847", descColor: "#5a9a30" },
        { label: "Other method",      desc: "Assets held under 12 months, or where discount/indexation don't apply. Full gain (or loss) is recognised without reduction.", bg: "#2a2a2a", border: "#3a3a3a", nameColor: "#bbbbbb", descColor: "#888888" },
      ]
    : [
        { label: "Discount method",   desc: "For assets held over 12 months. A 50% CGT discount applies to individuals. Most common for long-term share investors.",        bg: "#E6F1FB", border: "#85B7EB", nameColor: "#0C447C", descColor: "#185FA5" },
        { label: "Indexation method", desc: "For assets acquired before 21 Sep 1999. Cost base is indexed to CPI. Cannot use the 50% discount.",                           bg: "#EAF3DE", border: "#97C459", nameColor: "#27500A", descColor: "#3B6D11" },
        { label: "Other method",      desc: "Assets held under 12 months, or where discount/indexation don't apply. Full gain (or loss) is recognised without reduction.", bg: "#F1EFE8", border: "#B4B2A9", nameColor: "#444441", descColor: "#5F5E5A" },
      ];

  const th = { padding: "10px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8" };
  const td = { padding: "10px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard
          label="Discount method"
          value={fmt(disc.total_net_gain ?? 0)}
          sub={`${disc.event_count ?? 0} events · ${fmt(disc.total_discount_applied ?? 0)} discount`}
          color={C?.accentTagText || "#0C447C"} C={C}
        />
        <MetricCard
          label="Losses (other)"
          value={`−${fmt(loss.total_capital_loss ?? 0)}`}
          sub={`${loss.event_count ?? 0} events · no discount`}
          color={LOSS_CLR} C={C}
        />
        <MetricCard
          label="Total net gain"
          value={fmt(totalNet)}
          sub="after all adjustments"
          color={GAIN_CLR} C={C}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <CardBox C={C}>
          <CardTitle C={C}>Gross gain by method &amp; stock — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {bySymbol.map((r, i) => {
              const pct   = Math.round(Math.abs(r.gross) / maxAbs * 100);
              const color = r.gross >= 0 ? BLUE_LT : RED_LT;
              const label = r.method === "discount" ? "Discount" : "Other";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C?.text || "#222" }}>{r.symbol}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: C?.muted || "#999", width: 52, textAlign: "right", flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 14, background: C?.thBg || "#F5F5F3", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: r.gross >= 0 ? GAIN_CLR : LOSS_CLR, width: 64, textAlign: "right" }}>
                      {r.gross >= 0 ? "" : "−"}{fmt(Math.abs(r.gross))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>
            {[{ color: BLUE_LT, label: "Discount" }, { color: RED_LT, label: "Other / loss" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C?.muted || "#999" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </CardBox>

        <CardBox C={C}>
          <CardTitle C={C}>About CGT methods</CardTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {methodBlocks.map(m => (
              <div key={m.label} style={{ padding: "12px 14px", borderRadius: 8, border: `0.5px solid ${m.border}`, background: m.bg }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: m.nameColor, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: m.descColor, lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </CardBox>
      </div>

      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C?.text || "#222" }}>Per-stock breakdown</span>
          <button onClick={() => exportCSV(bySymbol, `method_breakdown_${selectedFY}.csv`)}
            style={{ fontSize: 11, padding: "5px 12px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: "transparent", color: C?.text || "#555", cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left",  width: 80 }}>Stock</th>
              <th style={{ ...th, textAlign: "left",  width: 80 }}>Method</th>
              <th style={{ ...th, textAlign: "right" }}>Gross gain</th>
              <th style={{ ...th, textAlign: "right" }}>Discount</th>
              <th style={{ ...th, textAlign: "right" }}>Net gain</th>
              <th style={{ ...th, textAlign: "right" }}>% of total</th>
            </tr>
          </thead>
          <tbody>
            {bySymbol.map((r, i) => {
              const totalDiscNet = Number(disc.total_net_gain ?? 0);
              const pct = r.net > 0 && totalDiscNet > 0 ? `${Math.round(r.net / totalDiscNet * 100)}%` : "—";
              const ms  = r.method === "discount" ? { bg: C?.accentTag || "#E6F1FB", color: C?.accentTagText || "#0C447C" } : { bg: C?.mutedTag || "#F1EFE8", color: C?.mutedTagText || "#5F5E5A" };
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.symbol}</td>
                  <td style={td}><Tag bg={ms.bg} color={ms.color}>{r.method}</Tag></td>
                  <td style={{ ...td, textAlign: "right", color: r.gross >= 0 ? GAIN_CLR : LOSS_CLR }}>{r.gross >= 0 ? "+" : "−"}{fmt(Math.abs(r.gross))}</td>
                  <td style={{ ...td, textAlign: "right", color: C?.muted || "#999" }}>{r.discount > 0 ? `−${fmt(r.discount)}` : "n/a"}</td>
                  <td style={{ ...td, textAlign: "right", color: r.net >= 0 ? GAIN_CLR : LOSS_CLR, fontWeight: 600 }}>{r.net >= 0 ? "+" : "−"}{fmt(Math.abs(r.net))}</td>
                  <td style={{ ...td, textAlign: "right", color: C?.muted || "#999" }}>{pct}</td>
                </tr>
              );
            })}
            <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
              <td colSpan={2} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Total</td>
              <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(data?.total_gross_gains ?? 0)}</td>
              <td style={{ ...td, textAlign: "right", color: LOSS_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>−{fmt(data?.total_cgt_discount_applied ?? 0)}</td>
              <td style={{ ...td, textAlign: "right", color: GAIN_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>+{fmt(totalNet)}</td>
              <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DIVIDEND EVENTS
// JSON fields: dividend_id, symbol, payment_date, cash_amount, franking_percent,
//   franking_credits (plural ✓), grossed_up_dividend
// withholding_tax / is_drp NOT in JSON → $0.00 / 0 events hardcoded
// ═══════════════════════════════════════════════════════════════════════════════
function DividendEventsChart({ data, C, selectedFY }) {
  const allEvents = Array.isArray(data) ? data : [];

  const [stockFilter, setStockFilter] = useState("");
  const [frankFilter, setFrankFilter] = useState("");
  const [typeFilter,  setTypeFilter]  = useState("");

  const symbols = useMemo(() => [...new Set(allEvents.map(e => e.symbol))].sort(), [allEvents]);

  const visible = useMemo(() => {
    let r = [...allEvents];
    if (stockFilter)               r = r.filter(e => e.symbol === stockFilter);
    if (frankFilter === "full")    r = r.filter(e => Number(e.franking_percent) === 100);
    if (frankFilter === "partial") r = r.filter(e => Number(e.franking_percent) > 0 && Number(e.franking_percent) < 100);
    if (frankFilter === "none")    r = r.filter(e => Number(e.franking_percent) === 0);
    return r;
  }, [allEvents, stockFilter, frankFilter, typeFilter]);

  const hasFilter     = stockFilter || frankFilter || typeFilter;
  const reset         = () => { setStockFilter(""); setFrankFilter(""); setTypeFilter(""); };
  const totalCash     = visible.reduce((s, e) => s + Number(e.cash_amount       ?? 0), 0);
  const totalFranking = visible.reduce((s, e) => s + Number(e.franking_credits  ?? 0), 0);
  const totalGrossed  = visible.reduce((s, e) => s + Number(e.grossed_up_dividend ?? 0), 0);

  const frankTag = (pct) =>
    pct === 100 ? { label: "Fully franked",  bg: C?.frankingBg || "#E1F5EE", color: C?.frankingText || "#085041" }
    : pct > 0   ? { label: "Partly franked", bg: C?.amberTag   || "#FAEEDA", color: C?.amberTagText || "#633806" }
    :             { label: "Unfranked",       bg: C?.mutedTag   || "#F1EFE8", color: C?.mutedTagText || "#5F5E5A" };

  const th = { padding: "9px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8" };
  const td = { padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total dividends"  value={fmt2(totalCash)}     sub="cash received"                      color={GAIN_CLR} C={C} />
        <MetricCard label="Franking credits" value={fmt2(totalFranking)} sub={`grossed-up: ${fmt2(totalGrossed)}`} color={GAIN_CLR} C={C} />
        <MetricCard label="Withholding tax"  value="$0.00"               sub="foreign holdings"                   color={C?.text}  C={C} />
        <MetricCard label="DRP shares"       value="0 events"            sub="reinvested as parcels"               color={C?.text}  C={C} />
      </div>

      <CardBox C={C} style={{ marginBottom: 16 }}>
        <CardTitle C={C}>Cash dividend vs franking credit — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
        {(() => {
          // Group by stock
          const byStock = {};
          visible.forEach(e => {
            if (!byStock[e.symbol]) byStock[e.symbol] = { cash: 0, franking: 0, count: 0 };
            byStock[e.symbol].cash     += Number(e.cash_amount     ?? 0);
            byStock[e.symbol].franking += Number(e.franking_credits ?? 0);
            byStock[e.symbol].count++;
          });
          const chartData = Object.entries(byStock).map(([symbol, v]) => ({
            symbol,
            "Cash dividend":  Math.round(v.cash),
            "Franking credit": Math.round(v.franking),
            grossed: Math.round(v.cash + v.franking),
            count: v.count,
          }));
          const DivTooltip = ({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = chartData.find(r => r.symbol === label) || {};
            return (
              <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
                <div style={{ fontWeight: 700, color: C?.text || "#222", marginBottom: 6 }}>
                  {label} <span style={{ fontWeight: 400, color: C?.muted || "#999" }}>· {d.count} payment{d.count !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 24, color: C?.frankingText || "#0F6E56", marginBottom: 2 }}>
                  <span>Cash dividend</span><span style={{ fontWeight: 600 }}>${d["Cash dividend"]?.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 24, color: C?.frankingMuted || "#1D9E75", marginBottom: 2 }}>
                  <span>Franking credit</span><span style={{ fontWeight: 600 }}>${d["Franking credit"]?.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ borderTop: `1px solid ${C?.border || "#E8E6E1"}`, paddingTop: 6, marginTop: 6, display: "flex", justifyContent: "space-between", gap: 24 }}>
                  <span style={{ color: C?.muted || "#999" }}>Grossed-up</span>
                  <span style={{ fontWeight: 700, color: C?.text || "#222" }}>${d.grossed?.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            );
          };
          if (chartData.length === 0) return <div style={{ padding: "24px 0", textAlign: "center", color: C?.muted || "#999", fontSize: 12 }}>No data</div>;
          return (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={3} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C?.border || "#E8E6E1"} vertical={false} />
                <XAxis dataKey="symbol" tick={{ fontSize: 11, fill: C?.muted || "#999" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} tick={{ fontSize: 10, fill: C?.muted || "#999" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<DivTooltip />} cursor={{ fill: C?.thBg || "#F5F5F3", radius: 4 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" iconSize={10} />
                <Bar dataKey="Cash dividend" fill="#1D9E75" radius={[4,4,0,0]} maxBarSize={44}>
                  <LabelList dataKey="Cash dividend" position="top" formatter={v => v > 0 ? `$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}` : ""} style={{ fontSize: 9, fill: "#0F6E56", fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="Franking credit" fill="#9FE1CB" radius={[4,4,0,0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          );
        })()}
      </CardBox>

      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, flexWrap: "wrap" }}>
          <FilterSel value={stockFilter} onChange={setStockFilter} C={C}>
            <option value="">All stocks</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSel>
          <FilterSel value={frankFilter} onChange={setFrankFilter} C={C}>
            <option value="">All franking</option>
            <option value="full">Fully franked</option>
            <option value="partial">Partially franked</option>
            <option value="none">Unfranked</option>
          </FilterSel>
          <FilterSel value={typeFilter} onChange={setTypeFilter} C={C}>
            <option value="">All types</option>
            <option value="cash">Cash only</option>
            <option value="drp">DRP</option>
          </FilterSel>
          <span style={{ fontSize: 11, color: C?.muted || "#999", marginLeft: "auto" }}>{visible.length} record{visible.length !== 1 ? "s" : ""}</span>
          {hasFilter && <button onClick={reset} style={{ fontSize: 11, color: C?.accent || "#378ADD", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset</button>}
          <button onClick={() => exportCSV(visible, `dividend_events_${selectedFY}.csv`)}
            style={{ fontSize: 11, padding: "5px 12px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: "transparent", color: C?.text || "#333", cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Pay date</th>
                <th style={{ ...th, textAlign: "left" }}>Stock</th>
                <th style={{ ...th, textAlign: "right" }}>Cash div.</th>
                <th style={{ ...th, textAlign: "left" }}>Franking</th>
                <th style={{ ...th, textAlign: "right" }}>Frank. credit</th>
                <th style={{ ...th, textAlign: "right" }}>Grossed-up</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0
                ? <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: "32px 16px", color: C?.muted || "#999" }}>No records match the current filters.</td></tr>
                : visible.map((e, i) => {
                    const tag = frankTag(Number(e.franking_percent ?? 0));
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                        <td style={td}>{fmtDate(e.payment_date)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{e.symbol}</td>
                        <td style={{ ...td, textAlign: "right", color: GAIN_CLR, fontWeight: 600 }}>{fmt2(e.cash_amount)}</td>
                        <td style={td}>
                          <Tag bg={tag.bg} color={tag.color}>{tag.label}</Tag>
                          <div style={{ height: 4, background: C?.thBg || "#F5F5F3", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                            <div style={{ width: `${Number(e.franking_percent ?? 0)}%`, height: "100%", background: GAIN_CLR, borderRadius: 2 }} />
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: "right", color: GAIN_CLR }}>{fmt2(e.franking_credits)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt2(e.grossed_up_dividend)}</td>
                      </tr>
                    );
                  })}
              <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
                <td colSpan={2} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Total ({visible.length})</td>
                <td style={{ ...td, textAlign: "right", color: GAIN_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(totalCash)}</td>
                <td style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }} />
                <td style={{ ...td, textAlign: "right", color: GAIN_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(totalFranking)}</td>
                <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(totalGrossed)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. DIVIDEND SUMMARY
// JSON fields: total_cash_dividends, total_franking_credits, total_grossed_up_income
// ═══════════════════════════════════════════════════════════════════════════════
function DividendSummaryChart({ data, C, selectedFY, dividendEvents = [] }) {
  const d        = data ?? {};
  const cash     = Number(d.total_cash_dividends   ?? 0);
  const franking = Number(d.total_franking_credits ?? 0);
  // total_grossed_up_income exists in JSON; compute as fallback
  const grossed  = Number(d.total_grossed_up_income ?? (cash + franking));
  const frankingRatio = grossed > 0 ? Math.round((franking / grossed) * 100) : 0;
  const circ = 2 * Math.PI * 20;
  const arc  = (frankingRatio / 100) * circ;

  const donutData = [
    { name: "Cash dividends",   value: cash,     color: GREEN_LT },
    { name: "Franking credits", value: franking,  color: GREEN_BG },
  ].filter(seg => seg.value > 0);

  const incomeRows = [
    { label: "Cash dividends received",     val: cash,    sign: "+", color: GAIN_CLR },
    { label: "Add: franking credits",        val: franking, sign: "+", color: GAIN_CLR },
    { label: "Less: withholding tax (WHT)", val: 0,        sign: "−", color: LOSS_CLR },
    { label: "DRP dividend value",           val: 0,        sign: "+", color: GAIN_CLR },
    { label: "Grossed-up taxable income",   val: grossed,  sign: "+", color: GAIN_CLR, bold: true },
  ];

  const frankTag = (pct) =>
    pct === 100 ? { label: "Fully franked",  bg: C?.frankingBg || "#E1F5EE", color: C?.frankingText || "#085041" }
    : pct > 0   ? { label: "Partly franked", bg: C?.amberTag   || "#FAEEDA", color: C?.amberTagText || "#633806" }
    :             { label: "Unfranked",       bg: C?.mutedTag   || "#F1EFE8", color: C?.mutedTagText || "#5F5E5A" };

  const th = { padding: "9px 16px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8" };
  const td = { padding: "10px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Cash dividends"    value={fmt2(cash)}    sub="received this year"     color={GAIN_CLR} C={C} />
        <MetricCard label="Franking credits"  value={fmt2(franking)} sub="offset against tax"    color={GAIN_CLR} C={C} />
        <MetricCard label="Grossed-up income" value={fmt2(grossed)}  sub="reportable at Item 11" color={C?.text}  C={C} />
        <MetricCard label="Franking ratio"    value={`${frankingRatio}%`} sub="of portfolio franked" color={GAIN_CLR} C={C} />
      </div>

      {/* Franking credit meter banner */}
      <div style={{ background: C?.frankingBg || "#E1F5EE", border: `0.5px solid ${C?.frankingBorder || "#9FE1CB"}`, borderRadius: 10, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={20} fill="none" stroke="#9FE1CB" strokeWidth={5} />
            <circle cx={26} cy={26} r={20} fill="none" stroke="#1D9E75" strokeWidth={5}
              strokeDasharray={`${arc} ${circ}`} strokeDashoffset={31} strokeLinecap="round" />
            <text x={26} y={30} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F6E56">{frankingRatio}%</text>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C?.frankingText || "#0F6E56" }}>Franking Credit Meter</div>
            <div style={{ fontSize: 11, color: C?.frankingMuted || "#1D9E75", marginTop: 2 }}>{fmt2(franking)} in franking credits available to offset your tax bill</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C?.frankingText || "#0F6E56" }}>{fmt2(franking)}</div>
          <div style={{ fontSize: 11, color: C?.frankingMuted || "#1D9E75" }}>grossed-up: {fmt2(grossed)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <CardBox C={C}>
          <CardTitle C={C}>Income by franking status — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" labelLine={false}>
                  {donutData.map((seg, i) => <Cell key={i} fill={seg.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt2(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {donutData.map((seg, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C?.muted || "#999", flex: 1 }}>{seg.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: GAIN_CLR }}>{fmt2(seg.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardBox>

        <CardBox C={C}>
          <CardTitle C={C}>Taxable income calculation</CardTitle>
          {incomeRows.map((row, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: row.bold ? "10px 0" : "9px 0",
              borderBottom: i < incomeRows.length - 1 ? `0.5px solid ${C?.border || "#E8E6E1"}` : "none",
              fontWeight: row.bold ? 700 : 400,
            }}>
              <span style={{ fontSize: 12, color: row.bold ? C?.text || "#222" : C?.muted || "#999" }}>{row.label}</span>
              <span style={{ fontSize: row.bold ? 15 : 13, fontWeight: 700, color: row.color }}>
                {row.sign === "−" ? "−" : "+"}{fmt2(row.val)}
              </span>
            </div>
          ))}
        </CardBox>
      </div>

      {/* Per-stock ATO table — reads directly from dividend_events */}
      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C?.text || "#222" }}>Per-stock summary — ATO Item 11</span>
          <Tag bg={C?.frankingBg || "#E1F5EE"} color={C?.frankingText || "#085041"}>{FY_LABEL[selectedFY] ?? selectedFY}</Tag>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left",  width: 80 }}>Stock</th>
                <th style={{ ...th, textAlign: "left" }}>Franking</th>
                <th style={{ ...th, textAlign: "right" }}>Cash div.</th>
                <th style={{ ...th, textAlign: "right" }}>Frank. credit</th>
                <th style={{ ...th, textAlign: "right" }}>Grossed-up</th>
                <th style={{ ...th, textAlign: "right" }}>ATO item</th>
              </tr>
            </thead>
            <tbody>
              {dividendEvents.map((e, i) => {
                const tag     = frankTag(Number(e.franking_percent ?? 0));
                const atoItem = Number(e.franking_percent ?? 0) > 0 ? "11D" : "11C";
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                    <td style={{ ...td, fontWeight: 600 }}>{e.symbol}</td>
                    <td style={td}><Tag bg={tag.bg} color={tag.color}>{tag.label}</Tag></td>
                    <td style={{ ...td, textAlign: "right" }}>{fmt2(e.cash_amount)}</td>
                    <td style={{ ...td, textAlign: "right", color: GAIN_CLR }}>{fmt2(e.franking_credits)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmt2(e.grossed_up_dividend)}</td>
                    <td style={{ ...td, textAlign: "right", color: C?.muted || "#999", fontSize: 11 }}>{atoItem}</td>
                  </tr>
                );
              })}
              <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
                <td colSpan={2} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Total</td>
                <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(cash)}</td>
                <td style={{ ...td, textAlign: "right", color: GAIN_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(franking)}</td>
                <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt2(grossed)}</td>
                <td style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <CardBox C={C}>
          <CardTitle C={C}>Export</CardTitle>
          <div style={{ display: "flex", gap: 8 }}>
            {["CSV", "PDF report"].map(l => (
              <div key={l} style={{ flex: 1, padding: 8, fontSize: 12, border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, textAlign: "center", cursor: "pointer", color: C?.text || "#333" }}>{l}</div>
            ))}
          </div>
        </CardBox>
        <CardBox C={C}>
          <CardTitle C={C}>ATO filing note</CardTitle>
          <p style={{ fontSize: 11, color: C?.muted || "#999", lineHeight: 1.6 }}>
            Report grossed-up dividends at <strong style={{ color: C?.text || "#222" }}>Item 11D</strong> (franked) and{" "}
            <strong style={{ color: C?.text || "#222" }}>Item 11C</strong> (unfranked).
            Franking credit offset of <strong style={{ color: C?.text || "#222" }}>{fmt2(franking)}</strong> claimable at{" "}
            <strong style={{ color: C?.text || "#222" }}>Item 13Q</strong>. Consult a registered tax agent.
          </p>
        </CardBox>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. REMAINING PARCELS
// JSON fields: parcel_id, symbol, acquired_date, original_quantity,
//   remaining_quantity, remaining_cost_base, unit_cost_base
// market price NOT in JSON → mockPrices (swap with real API later)
// ═══════════════════════════════════════════════════════════════════════════════
function RemainingParcelsChart({ data, C, selectedFY }) {
  const parcels    = Array.isArray(data) ? data : [];
  const mockPrices = { CBA: 138, BHP: 52.5, CSL: 290, WBC: 31.2, TLS: 3.9 };

  const [asAt,         setAsAt]         = useState("today");
  const [stockFilter,  setStockFilter]  = useState("");
  const [parcelFilter, setParcelFilter] = useState("");
  const [gainFilter,   setGainFilter]   = useState("");

  const enriched = useMemo(() => parcels.map(p => {
    const price   = mockPrices[p.symbol] ?? Number(p.unit_cost_base ?? 0);
    const mktVal  = Math.round(Number(p.remaining_quantity ?? 0) * price);
    const unreal  = mktVal - Number(p.remaining_cost_base ?? 0);
    const today   = new Date();
    const acq     = new Date(p.acquired_date);
    const days    = Math.round((today - acq) / 86400000);
    const yr      = Math.floor(days / 365);
    const mo      = Math.floor((days % 365) / 30);
    const holdStr = yr > 0 ? `${yr}y ${mo}m` : `${mo}m`;
    return { ...p, mktVal, unreal, days, holdStr, eligible: days > 365 };
  }), [parcels]);

  const visible = useMemo(() => {
    let r = [...enriched];
    if (stockFilter)                 r = r.filter(p => p.symbol === stockFilter);
    if (parcelFilter === "discount") r = r.filter(p => p.eligible);
    if (parcelFilter === "short")    r = r.filter(p => !p.eligible);
    if (gainFilter === "gain")       r = r.filter(p => p.unreal > 0);
    if (gainFilter === "loss")       r = r.filter(p => p.unreal < 0);
    return r;
  }, [enriched, stockFilter, parcelFilter, gainFilter]);

  const hasFilter   = stockFilter || parcelFilter || gainFilter;
  const reset       = () => { setStockFilter(""); setParcelFilter(""); setGainFilter(""); };
  const totalCost   = visible.reduce((s, p) => s + Number(p.remaining_cost_base ?? 0), 0);
  const totalMkt    = visible.reduce((s, p) => s + p.mktVal, 0);
  const totalUnreal = visible.reduce((s, p) => s + p.unreal, 0);
  const symbols     = [...new Set(parcels.map(p => p.symbol))];
  const maxAbs      = Math.max(...enriched.map(p => Math.abs(p.unreal)), 1);

  const bySymbol = symbols.map(sym => ({
    symbol: sym,
    unreal: enriched.filter(p => p.symbol === sym).reduce((s, p) => s + p.unreal, 0),
  })).sort((a, b) => b.unreal - a.unreal);

  const AS_AT_OPTIONS = [
    { value: "today",   label: `Today (${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })})` },
    { value: "jun2025", label: "30 Jun 2025" },
    { value: "jun2024", label: "30 Jun 2024" },
  ];

  const th = { padding: "9px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C?.muted || "#999", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, background: C?.thBg || "#FAFAF8" };
  const td = { padding: "9px 12px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, color: C?.text || "#222" };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: C?.muted || "#999" }}>As at</span>
        <select value={asAt} onChange={e => setAsAt(e.target.value)}
          style={{ fontSize: 12, padding: "5px 10px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: C?.bg || "#fff", color: C?.text || "#222", outline: "none", cursor: "pointer" }}>
          {AS_AT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        <MetricCard label="Open parcels"    value={visible.length}  sub={`across ${symbols.length} stocks`} color={C?.text}                             C={C} />
        <MetricCard label="Total cost base" value={fmt(totalCost)}  sub="acquisition cost"                  color={C?.text}                             C={C} />
        <MetricCard label="Market value"    value={fmt(totalMkt)}   sub="at indicative price"               color={C?.text}                             C={C} />
        <MetricCard label="Unrealised gain" value={`${totalUnreal >= 0 ? "+" : "−"}${fmt(Math.abs(totalUnreal))}`} sub="if sold today" color={totalUnreal >= 0 ? GAIN_CLR : LOSS_CLR} C={C} />
      </div>

      <CardBox C={C} style={{ marginBottom: 16 }}>
        <CardTitle C={C}>Unrealised gain / loss by stock — {FY_LABEL[selectedFY] ?? selectedFY}</CardTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bySymbol.map((r, i) => {
            const pct   = Math.round(Math.abs(r.unreal) / maxAbs * 100);
            const color = r.unreal >= 0 ? GREEN_LT : RED_LT;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C?.text || "#222", width: 52, flexShrink: 0 }}>{r.symbol}</span>
                <div style={{ flex: 1, height: 20, background: C?.thBg || "#F5F5F3", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: r.unreal >= 0 ? GAIN_CLR : LOSS_CLR, width: 72, textAlign: "right" }}>
                  {r.unreal >= 0 ? "+" : "−"}{fmt(Math.abs(r.unreal))}
                </span>
              </div>
            );
          })}
        </div>
      </CardBox>

      <div style={{ background: C?.bg || "#fff", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: `1px solid ${C?.border || "#E8E6E1"}`, flexWrap: "wrap" }}>
          <FilterSel value={stockFilter}  onChange={setStockFilter}  C={C}>
            <option value="">All stocks</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSel>
          <FilterSel value={parcelFilter} onChange={setParcelFilter} C={C}>
            <option value="">All parcels</option>
            <option value="discount">Discount eligible (&gt;12 mo)</option>
            <option value="short">Short-hold (&lt;12 mo)</option>
          </FilterSel>
          <FilterSel value={gainFilter}   onChange={setGainFilter}   C={C}>
            <option value="">Gains &amp; losses</option>
            <option value="gain">Gains only</option>
            <option value="loss">Losses only</option>
          </FilterSel>
          <span style={{ fontSize: 11, color: C?.muted || "#999", marginLeft: "auto" }}>{visible.length} parcel{visible.length !== 1 ? "s" : ""}</span>
          {hasFilter && <button onClick={reset} style={{ fontSize: 11, color: C?.accent || "#378ADD", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Reset</button>}
          <button onClick={() => exportCSV(visible, `remaining_parcels_${selectedFY}.csv`)}
            style={{ fontSize: 11, padding: "5px 12px", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, background: "transparent", color: C?.text || "#333", cursor: "pointer" }}>
            Export CSV
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left",  width: 68 }}>Stock</th>
                <th style={{ ...th, textAlign: "left",  width: 90 }}>Acquired</th>
                <th style={{ ...th, textAlign: "right", width: 44 }}>Qty</th>
                <th style={{ ...th, textAlign: "right" }}>Cost base</th>
                <th style={{ ...th, textAlign: "right" }}>Mkt value</th>
                <th style={{ ...th, textAlign: "right" }}>Unreal. gain</th>
                <th style={{ ...th, textAlign: "right", width: 90 }}>Hold period</th>
                <th style={{ ...th, textAlign: "right", width: 80 }}>CGT status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0
                ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", padding: "32px 16px", color: C?.muted || "#999" }}>No parcels match the current filters.</td></tr>
                : visible.map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : C?.thBg || "#FAFAF8" }}>
                      <td style={{ ...td, fontWeight: 600 }}>{p.symbol}</td>
                      <td style={td}>{fmtDate(p.acquired_date)}</td>          {/* acquired_date ✓ */}
                      <td style={{ ...td, textAlign: "right" }}>{p.remaining_quantity}</td>   {/* remaining_quantity ✓ */}
                      <td style={{ ...td, textAlign: "right" }}>{fmt(p.remaining_cost_base)}</td> {/* remaining_cost_base ✓ */}
                      <td style={{ ...td, textAlign: "right" }}>{fmt(p.mktVal)}</td>
                      <td style={{ ...td, textAlign: "right", color: p.unreal >= 0 ? GAIN_CLR : LOSS_CLR, fontWeight: 600 }}>
                        {p.unreal >= 0 ? "+" : "−"}{fmt(Math.abs(p.unreal))}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: p.eligible ? C?.muted || "#999" : "#BA7517" }}>{p.holdStr}</div>
                        <div style={{ height: 4, background: C?.thBg || "#F5F5F3", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(p.days / 365 * 100, 100)}%`, height: "100%", background: p.eligible ? GAIN_CLR : AMBER_LT, borderRadius: 2 }} />
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {p.eligible
                          ? <Tag bg={C?.accentTag || "#E6F1FB"} color={C?.accentTagText || "#0C447C"}>Discount</Tag>
                          : <Tag bg={C?.amberTag || "#FAEEDA"} color={C?.amberTagText || "#633806"}>Short-hold</Tag>}
                      </td>
                    </tr>
                  ))}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr style={{ background: C?.thBg || "#FAFAF8", fontWeight: 700 }}>
                  <td colSpan={3} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>Total ({visible.length} parcels)</td>
                  <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(totalCost)}</td>
                  <td style={{ ...td, textAlign: "right", borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>{fmt(totalMkt)}</td>
                  <td style={{ ...td, textAlign: "right", color: totalUnreal >= 0 ? GAIN_CLR : LOSS_CLR, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }}>
                    {totalUnreal >= 0 ? "+" : "−"}{fmt(Math.abs(totalUnreal))}
                  </td>
                  <td colSpan={2} style={{ ...td, borderTop: `1px solid ${C?.border || "#E8E6E1"}` }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C?.muted || "#999", background: C?.thBg || "#FAFAF8", border: `1px solid ${C?.border || "#E8E6E1"}`, borderRadius: 8, padding: "10px 14px", lineHeight: 1.6 }}>
        Unrealised gains are estimates based on indicative market prices and may differ at time of disposal.
        Hold period determines CGT discount eligibility — parcels held over 12 months qualify for the 50% discount.
      </div>
    </>
  );
}

// CHART ROUTER — selectedFY comes from TaxReport.jsx dropdown, passed to all charts
//
// extraData shape (provided by TaxReport.jsx when it fetches sibling data):
//   { cgtEvents: [], dividendEvents: [] }
//   — needed by CgtSummaryChart, MethodBreakdownChart, DividendSummaryChart
//   which render cross-section detail tables (ATO schedule rows, per-stock breakdown)
//
const CHART_MAP = {
  cgt_events:        CgtEventsChart,
  cgt_summary:       CgtSummaryChart,
  method_breakdown:  MethodBreakdownChart,
  dividend_events:   DividendEventsChart,
  dividend_summary:  DividendSummaryChart,
  remaining_parcels: RemainingParcelsChart,
};

export default function ReportChart({ reportId, data, C, selectedFY, extraData = {} }) {
  const Chart = CHART_MAP[reportId];
  if (!Chart || !data) return null;

  const sharedProps = {
    data,
    C,
    selectedFY,
    // Pass sibling arrays only to the charts that need them
    ...(reportId === "cgt_summary"      && { cgtEvents:      extraData.cgtEvents      ?? [] }),
    ...(reportId === "method_breakdown" && { cgtEvents:      extraData.cgtEvents      ?? [] }),
    ...(reportId === "dividend_summary" && { dividendEvents: extraData.dividendEvents ?? [] }),
  };

  return <Chart {...sharedProps} />;
}