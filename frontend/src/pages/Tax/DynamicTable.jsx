// DynamicTable.jsx
// Renders any JSON shape: array of objects, nested object, or key-value object.
// Array shape gets a filter bar (date ranges, dropdown filters) + column sort.
// Numeric range filters intentionally removed — too noisy for financial tables.

import React, { useState, useMemo } from "react";
import { formatValue, formatLabel, detectDateColumns, detectNumericColumns, applyFiltersAndSort } from "./TableUtils";

// Filter Bar (only shown for array data)
function FilterBar({ data, columns, dateCols, numericCols, filters, setFilters, sort, setSort, C }) {
  // Dropdown columns: low-cardinality strings only — exclude numerics, dates, booleans, and _id suffix cols
  const dropdownCols = useMemo(() => {
    return columns.filter((col) => {
      if (dateCols.has(col) || numericCols.has(col)) return false;
      if (col.toLowerCase().endsWith("_id") || col.toLowerCase() === "id") return false;
      const values = data.map((r) => r[col]);
      // Exclude boolean columns
      if (values.every((v) => typeof v === "boolean" || v === true || v === false)) return false;
      const unique = new Set(values.map(String));
      return unique.size >= 2 && unique.size <= 12;
    });
  }, [columns, data, dateCols, numericCols]);

  const hasActiveFilters =
    Object.values(filters.columnFilters || {}).some((v) => v !== "") ||
    Object.values(filters.dateRanges || {}).some((r) => r.from || r.to);

  const reset = () => {
    setFilters({ columnFilters: {}, dateRanges: {} });
    setSort(null);
  };

  const setColFilter = (col, val) =>
    setFilters((f) => ({ ...f, columnFilters: { ...f.columnFilters, [col]: val } }));

  const setDateRange = (col, side, val) =>
    setFilters((f) => ({
      ...f,
      dateRanges: {
        ...f.dateRanges,
        [col]: { ...(f.dateRanges?.[col] || {}), [side]: val },
      },
    }));

  const inputStyle = {
    fontSize: 12,
    padding: "5px 9px",
    height: 30,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.bg,
    color: C.text,
    outline: "none",
    minWidth: 0,
  };
  const labelStyle = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: C.muted,
    marginBottom: 3,
  };
  const groupStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 110,
  };

  // Sort dropdown options from all columns
  const sortOptions = columns.flatMap((col) => [
    { value: `${col}__asc`,  label: `${formatLabel(col)}: A → Z` },
    { value: `${col}__desc`, label: `${formatLabel(col)}: Z → A` },
  ]);

  const currentSortVal = sort ? `${sort.key}__${sort.dir === 1 ? "asc" : "desc"}` : "";

  const handleSortChange = (e) => {
    const val = e.target.value;
    if (!val) { setSort(null); return; }
    const [key, dir] = val.split("__");
    setSort({ key, dir: dir === "asc" ? 1 : -1 });
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "flex-end",
        padding: "12px 14px",
        marginBottom: 12,
        background: C.thBg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
      }}
    >
      {/* Sort */}
      <div style={groupStyle}>
        <div style={labelStyle}>Sort by</div>
        <select value={currentSortVal} onChange={handleSortChange} style={{ ...inputStyle, minWidth: 170 }}>
          <option value="">— Default order —</option>
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Dropdown filters for low-cardinality string columns */}
      {dropdownCols.map((col) => {
        const unique = [...new Set(data.map((r) => r[col]))].sort();
        return (
          <div key={col} style={groupStyle}>
            <div style={labelStyle}>{formatLabel(col)}</div>
            <select
              value={filters.columnFilters?.[col] || ""}
              onChange={(e) => setColFilter(col, e.target.value)}
              style={inputStyle}
            >
              <option value="">All</option>
              {unique.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        );
      })}

      {/* Date range pickers — only acquired_date and disposal_date shown, others skipped */}
      {[...dateCols]
        .filter((col) => ["acquired_date", "disposal_date", "payment_date"].includes(col))
        .map((col) => (
          <div key={col} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={labelStyle}>{formatLabel(col)}</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="date"
                style={inputStyle}
                value={filters.dateRanges?.[col]?.from || ""}
                placeholder=""
                onChange={(e) => setDateRange(col, "from", e.target.value)}
              />
              <span style={{ fontSize: 11, color: C.muted }}>to</span>
              <input
                type="date"
                style={inputStyle}
                value={filters.dateRanges?.[col]?.to || ""}
                placeholder=""
                onChange={(e) => setDateRange(col, "to", e.target.value)}
              />
            </div>
          </div>
        ))}

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={reset}
          style={{
            fontSize: 12,
            padding: "5px 14px",
            height: 30,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            background: "transparent",
            color: C.muted,
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

// Main DynamicTable
export default function DynamicTable({ data, C }) {
  const [filters, setFilters] = useState({ columnFilters: {}, dateRanges: {} });
  const [sort, setSort] = useState(null);

  const thStyle = {
    background:    C.thBg,
    padding:       "10px 14px",
    textAlign:     "left",
    color:         C.thText || C.muted,
    fontSize:      11,
    fontWeight:    700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom:  `1px solid ${C.border}`,
    whiteSpace:    "nowrap",
    cursor:        "pointer",
    userSelect:    "none",
  };
  const tdStyle = {
    padding:      "10px 14px",
    color:        C.text,
    fontSize:     13,
    borderBottom: `1px solid ${C.border}`,
    whiteSpace:   "nowrap",
    background:   "transparent",
  };
  const trBg = (i) => ({ background: i % 2 === 0 ? "transparent" : C.rowAlt });

  if (!data) {
    return <p style={{ color: C.muted, padding: "32px 16px" }}>No data found.</p>;
  }

  // Case 1: array of objects
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div className="tax-empty">
          <div className="tax-empty__icon">✓</div>
          <div className="tax-empty__title" style={{ color: C.text }}>No records</div>
          <div className="tax-empty__desc" style={{ color: C.muted }}>Nothing to display for this report.</div>
        </div>
      );
    }

    const columns   = Object.keys(data[0]);
    const dateCols  = detectDateColumns(data);
    const numericCols = detectNumericColumns(data);

    const displayed = applyFiltersAndSort(data, filters, sort);

    const handleColSort = (col) => {
      setSort((prev) =>
        prev?.key === col ? { key: col, dir: prev.dir * -1 } : { key: col, dir: 1 }
      );
    };

    const sortIndicator = (col) => {
      if (sort?.key !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
      return <span style={{ marginLeft: 4, color: C.accent }}>{sort.dir === 1 ? "↑" : "↓"}</span>;
    };

    return (
      <>
        <FilterBar
          data={data}
          columns={columns}
          dateCols={dateCols}
          numericCols={numericCols}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          C={C}
        />

        <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
          {displayed.length === data.length
            ? `${data.length} record${data.length !== 1 ? "s" : ""}`
            : `${displayed.length} of ${data.length} records`}
        </p>

        <table className="tax-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  style={thStyle}
                  onClick={() => handleColSort(col)}
                  title={`Sort by ${formatLabel(col)}`}
                >
                  {formatLabel(col)}{sortIndicator(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ ...tdStyle, textAlign: "center", padding: "32px 16px", color: C.muted }}
                >
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              displayed.map((row, i) => (
                <tr key={i} style={trBg(i)}>
                  {columns.map((col) => (
                    <td key={col} style={tdStyle}>{formatValue(row[col])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </>
    );
  }

  // Case 2: object of objects (e.g. Method Breakdown)
  const values = Object.values(data);
  const isNestedObject =
    values.length > 0 &&
    values.every((v) => typeof v === "object" && v !== null && !Array.isArray(v));

  if (isNestedObject) {
    const rowKeys = Object.keys(data);
    const columns = Object.keys(values[0]);
    return (
      <table className="tax-table">
        <thead>
          <tr>
            <th style={thStyle}>Method</th>
            {columns.map((col) => <th key={col} style={thStyle}>{formatLabel(col)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rowKey, i) => (
            <tr key={rowKey} style={trBg(i)}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{formatLabel(rowKey)}</td>
              {columns.map((col) => <td key={col} style={tdStyle}>{formatValue(data[rowKey][col])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // Case 3: simple key-value object
  return (
    <table className="tax-table tax-table--kv">
      <thead>
        <tr>
          <th style={thStyle}>Field</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([key, value], i) => (
          <tr key={key} style={trBg(i)}>
            <td style={tdStyle}>{formatLabel(key)}</td>
            <td style={{ ...tdStyle, textAlign: "right", fontFamily: "monospace" }}>{formatValue(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}