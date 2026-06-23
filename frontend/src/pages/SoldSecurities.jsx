import React from "react";
import { Alert, Chip, Skeleton } from "@mui/material";
import { Download } from "@mui/icons-material";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";

import "../components/tools-theme.css";

import { getSoldSecurities } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const SoldSecurities = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["sold-securities", userId],
    queryFn:  () => getSoldSecurities(userId),
    staleTime: 86_400_000, // 24 h — Group D engine
    enabled:  !authLoading && !!userId,
  });

  // mart fields: sell_id (not disposal_id), sell_date (not disposal_date)
  const rows = result?.data ?? [];
  const securities = rows.map(r => ({
    ...r,
    disposal_id:   r.sell_id,
    disposal_date: r.sell_date,
  }));
  const warning = result?.warning || null;

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const totals = securities.reduce(
    (acc, row) => {
      acc.quantity += Number(row.quantity || row.units_disposed || 0);
      acc.proceeds += Number(row.net_proceeds || row.proceeds || 0);
      acc.costBase += Number(row.cost_base || 0);
      acc.realisedGain += Number(row.realised_gain || row.raw_gain || 0);
      return acc;
    },
    {
      quantity: 0,
      proceeds: 0,
      costBase: 0,
      realisedGain: 0,
    },
  );

  // const gains = securities.filter(
  //   (row) => Number(row.realised_gain || row.raw_gain || 0) >= 0,
  // ).length;

  // const losses = securities.filter(
  //   (row) => Number(row.realised_gain || row.raw_gain || 0) < 0,
  // ).length;

  const exportToXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(securities);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sold Securities");
    XLSX.writeFile(wb, "sold_securities.xlsx");
  };

  // const renderSkeletonCards = () =>
  //   Array.from({ length: 4 }).map((_, index) => (
  //     <div className="tool-card" key={index}>
  //       <Skeleton variant="text" width={140} height={26} />
  //       <Skeleton variant="text" width={130} height={42} />
  //       <Skeleton variant="text" width={100} height={22} />
  //     </div>
  //   ));

  const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: 8 }).map((__, cellIndex) => (
          <td key={cellIndex}>
            <Skeleton variant="text" height={32} />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="tool-page">
      <div className="tool-hero">
        <div>
          <p className="tool-hero-title">Sold Securities</p>
          <p className="tool-hero-subtitle">
            Track sold investments and review realised profit or loss for each
            disposal.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={120} height={28} />
          ) : (
            `${securities.length} sales`
          )}
        </div>
      </div>

      {warning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warning}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* <div className="tool-grid">
        {loading ? (
          renderSkeletonCards()
        ) : (
          <>
            <div className="tool-card">
              <p className="tool-label">Total Sales</p>
              <h3 className="tool-value">{securities.length}</h3>
              <span className="tool-subtext">Sold records</span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Total Proceeds</p>
              <h3 className="tool-value">{money(totals.proceeds)}</h3>
              <span className="tool-subtext">After sale value</span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Realised Gain/Loss</p>
              <h3
                className={
                  totals.realisedGain >= 0
                    ? "tool-value positive-value"
                    : "tool-value negative-value"
                }
              >
                {money(totals.realisedGain)}
              </h3>
              <span
                className={
                  totals.realisedGain >= 0
                    ? "tool-subtext positive-value"
                    : "tool-subtext negative-value"
                }
              >
                Net realised result
              </span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Gain / Loss Count</p>
              <h3 className="tool-value">
                {gains} / {losses}
              </h3>
              <span className="tool-subtext">Profitable vs loss sales</span>
            </div>
          </>
        )}
      </div> */}

      <div className="tool-table-card">
        <div className="table-top-bar">
          <div>
            <h3 className="tool-panel-title">Sold Securities Breakdown</h3>
          </div>

          <div className="table-filter-group">
            <select className="table-filter" disabled={loading}>
              <option>All symbols</option>
              {securities.map((row, index) => (
                <option key={`${row.symbol}-${index}`}>
                  {row.symbol || "-"}
                </option>
              ))}
            </select>

            <select className="table-filter" disabled={loading}>
              <option>All results</option>
              <option>Gain only</option>
              <option>Loss only</option>
            </select>

            <button
              className="table-filter"
              onClick={exportToXLSX}
              disabled={loading || securities.length === 0}
              style={{ cursor: loading ? "not-allowed" : "pointer" }}
            >
              <Download sx={{ fontSize: 16, verticalAlign: "middle" }} /> Export
            </button>

            <div className="table-action-group">
              <span>
                {loading ? (
                  <Skeleton variant="text" width={80} height={24} />
                ) : (
                  `${securities.length} records`
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="table-scroll">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Cost Base</th>
                <th>Proceeds</th>
                <th>Realised Gain/Loss</th>
                <th>Held</th>
                <th>Result</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : securities.length === 0 ? (
                <tr>
                  <td colSpan="8" className="tool-empty">
                    No sold securities found.
                  </td>
                </tr>
              ) : (
                securities.map((row, index) => {
                  const gain = Number(row.realised_gain || row.raw_gain || 0);
                  const isGain = gain >= 0;

                  return (
                    <tr key={row.disposal_id || index}>
                      <td>{row.disposal_date || row.date || "-"}</td>
                      <td>{row.symbol || "-"}</td>
                      <td>{row.quantity || row.units_disposed || 0}</td>
                      <td>{money(row.cost_base)}</td>
                      <td>{money(row.net_proceeds || row.proceeds)}</td>
                      <td
                        className={isGain ? "positive-value" : "negative-value"}
                      >
                        {money(gain)}
                      </td>
                      <td>
                        {row.holding_days ? `${row.holding_days} days` : "-"}
                      </td>
                      <td>
                        <Chip
                          size="small"
                          label={isGain ? "Gain" : "Loss"}
                          color={isGain ? "success" : "error"}
                          variant="outlined"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!loading && securities.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td></td>
                  <td>{totals.quantity}</td>
                  <td>{money(totals.costBase)}</td>
                  <td>{money(totals.proceeds)}</td>
                  <td
                    className={
                      totals.realisedGain >= 0
                        ? "positive-value"
                        : "negative-value"
                    }
                  >
                    {money(totals.realisedGain)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default SoldSecurities;
