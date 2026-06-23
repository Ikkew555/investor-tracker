import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Skeleton, Alert } from "@mui/material";

import "../components/tools-theme.css";

import { getMultiPeriod } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const MultiPeriod = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["multi-period", userId],
    queryFn:  () => getMultiPeriod(userId),
    staleTime: 1_200_000, // 20 min — Group A engine
    enabled:  !authLoading && !!userId,
  });

  const rows = result?.data ?? [];
  const warning = result?.warning || null;
  const periods = useMemo(() => rows.map(r => ({
    ...r,
    period:     r.period_label,
    return_pct: parseFloat(r.total_return_pct || 0),
  })), [rows]);
  const anchorDate = useMemo(() =>
    rows.length > 0
      ? rows.reduce((min, r) => (r.from_date < min ? r.from_date : min), rows[0].from_date)
      : ""
  , [rows]);

  const money = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const percent = (value) => `${Number(value || 0).toFixed(2)}%`;

  const bestPeriod =
    periods.length > 0
      ? periods.reduce((best, current) =>
          current.return_pct > best.return_pct ? current : best,
        )
      : null;

  const worstPeriod =
    periods.length > 0
      ? periods.reduce((worst, current) =>
          current.return_pct < worst.return_pct ? current : worst,
        )
      : null;

  const averageReturn =
    periods.length > 0
      ? periods.reduce((sum, row) => sum + Number(row.return_pct || 0), 0) /
        periods.length
      : 0;

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: 7 }).map((__, cellIndex) => (
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
          <p className="tool-hero-title">Multi-Period Returns</p>

          <p className="tool-hero-subtitle">
            Compare portfolio returns across different time periods.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={140} height={28} />
          ) : (
            `Anchor: ${anchorDate || "-"}`
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

      <div className="tool-table-card">
        <div className="table-top-bar">
          <div className="table-filter-group">
            <select className="table-filter" disabled={loading}>
              <option>All periods</option>

              {periods.map((row) => (
                <option key={row.period}>{row.period}</option>
              ))}
            </select>
          </div>

          <div className="table-action-group">
            <span>
              {loading ? (
                <Skeleton variant="text" width={80} height={24} />
              ) : (
                `${periods.length} records`
              )}
            </span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Capital Gain</th>
                <th>Dividend Income</th>
                <th>Total Return</th>
                <th>Return %</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan="7" className="tool-empty">
                    No multi-period data found.
                  </td>
                </tr>
              ) : (
                periods.map((row) => (
                  <tr key={row.period}>
                    <td>{row.period}</td>

                    <td>{money(row.opening_value)}</td>

                    <td>{money(row.closing_value)}</td>

                    <td>{money(row.capital_gain)}</td>

                    <td>{money(row.dividend_income)}</td>

                    <td
                      className={
                        Number(row.total_return || 0) >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {money(row.total_return)}
                    </td>

                    <td
                      className={
                        Number(row.return_pct || 0) >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {percent(row.return_pct)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tool-panel">
        <div className="tool-panel-header">
          <div>
            <h3 className="tool-panel-title">Return % by Period</h3>

            <p className="tool-panel-subtitle">
              Compare short-term and long-term portfolio performance.
            </p>
          </div>

          <span className="tool-badge">AUD Return</span>
        </div>

        {loading ? (
          <Skeleton
            variant="rounded"
            width="100%"
            height={320}
            sx={{ borderRadius: "18px" }}
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={periods}
              layout="vertical"
              margin={{
                top: 12,
                right: 34,
                left: 16,
                bottom: 12,
              }}
              barCategoryGap={18}
            >
              <XAxis
                type="number"
                tickFormatter={(value) => `${value}%`}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                dataKey="period"
                type="category"
                width={90}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={{
                  fill: "rgba(79, 124, 255, 0.08)",
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(2)}%`,
                  "Return",
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e7ebf3",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
                }}
              />

              <Bar
                dataKey="return_pct"
                fill="#4f7cff"
                radius={[0, 10, 10, 0]}
                barSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="tool-insight-grid">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div className="tool-insight-card" key={index}>
                <Skeleton variant="text" width={120} height={24} />

                <Skeleton variant="text" width={140} height={32} />
              </div>
            ))
          ) : (
            <>
              <div className="tool-insight-card">
                <span>Best Period</span>

                <strong
                  className={
                    Number(bestPeriod?.return_pct || 0) >= 0
                      ? "positive-value"
                      : "negative-value"
                  }
                >
                  {bestPeriod?.period || "-"} (
                  {Number(bestPeriod?.return_pct || 0) >= 0 ? "+" : ""}
                  {Number(bestPeriod?.return_pct || 0).toFixed(2)}
                  %)
                </strong>
              </div>

              <div className="tool-insight-card">
                <span>Worst Period</span>

                <strong
                  className={
                    Number(worstPeriod?.return_pct || 0) >= 0
                      ? "positive-value"
                      : "negative-value"
                  }
                >
                  {worstPeriod?.period || "-"} (
                  {Number(worstPeriod?.return_pct || 0) >= 0 ? "+" : ""}
                  {Number(worstPeriod?.return_pct || 0).toFixed(2)}
                  %)
                </strong>
              </div>

              <div className="tool-insight-card">
                <span>Average Return</span>

                <strong
                  className={
                    averageReturn >= 0 ? "positive-value" : "negative-value"
                  }
                >
                  {averageReturn >= 0 ? "+" : ""}
                  {averageReturn.toFixed(2)}%
                </strong>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiPeriod;
