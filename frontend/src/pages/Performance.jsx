import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import { Box, Typography, Button, Stack, Paper, Skeleton } from "@mui/material";

import dayjs from "dayjs";
import "../components/tools-theme.css";

import { getPerformance } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const PerformancePage = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [granularity, setGranularity] = useState("1Y");

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["performance", userId],
    queryFn:  () => getPerformance(userId),
    staleTime: 1_200_000, // 20 min — Group A engine
    enabled:  !authLoading && !!userId,
  });

  const money = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const rows = result?.data ?? [];
  const holdings = useMemo(() => rows.map(r => ({
    ...r,
    dividends:  parseFloat(r.dividend_income  || 0),
    return_pct: parseFloat(r.total_return_pct || 0),
  })), [rows]);

  const summary = useMemo(() => {
    const opening_value   = holdings.reduce((s, r) => s + parseFloat(r.opening_value   || 0), 0);
    const closing_value   = holdings.reduce((s, r) => s + parseFloat(r.closing_value   || 0), 0);
    const capital_gain    = holdings.reduce((s, r) => s + parseFloat(r.capital_gain    || 0), 0);
    const dividend_income = holdings.reduce((s, r) => s + parseFloat(r.dividend_income || 0), 0);
    const total_return    = holdings.reduce((s, r) => s + parseFloat(r.total_return    || 0), 0);
    const total_return_pct = opening_value > 0 ? (total_return / opening_value) * 100 : 0;
    return { opening_value, closing_value, capital_gain, dividend_income, total_return, total_return_pct };
  }, [holdings]);

  const performance = useMemo(() => ({
    summary,
    holdings,
    meta: rows.length > 0 ? { from_date: rows[0].from_date, to_date: rows[0].to_date } : {},
  }), [summary, holdings, rows]);

  const generateChartData = (fromDate, toDate, start, end) => {
    const points = 6;
    const result = [];

    if (!fromDate || !toDate) return result;

    for (let i = 0; i <= points; i++) {
      const ratio = i / points;

      const currentDate = new Date(
        new Date(fromDate).getTime() +
          ratio * (new Date(toDate).getTime() - new Date(fromDate).getTime()),
      );

      const wave = Math.sin(ratio * Math.PI * 2) * 350;
      const value =
        Number(start || 0) +
        (Number(end || 0) - Number(start || 0)) * ratio +
        wave;

      result.push({
        date: currentDate.toISOString().slice(0, 10),
        value: Math.round(value),
      });
    }

    return result;
  };

  const renderSkeletonCards = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <Paper className="tool-card" key={index}>
        <Skeleton variant="text" width={120} height={28} />
        <Skeleton variant="text" width={160} height={42} />
        <Skeleton variant="text" width={100} height={24} />
      </Paper>
    ));

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: 8 }).map((__, cellIndex) => (
          <td key={cellIndex}>
            <Skeleton variant="text" height={32} />
          </td>
        ))}
      </tr>
    ));

  if (error) {
    return (
      <Box className="performance-page">
        <div className="content-wrapper">
          <Typography color="error">{error}</Typography>
        </div>
      </Box>
    );
  }

  const chartData = generateChartData(
    performance?.meta?.from_date,
    performance?.meta?.to_date,
    summary.opening_value,
    summary.closing_value,
  );

  const totalCostBase = holdings.reduce(
    (sum, row) => sum + Number(row.cost_base || 0),
    0,
  );

  const totalMarketValue = holdings.reduce(
    (sum, row) => sum + Number(row.market_value || 0),
    0,
  );

  const totalCapitalGain = holdings.reduce(
    (sum, row) => sum + Number(row.capital_gain || 0),
    0,
  );

  const totalDividends = holdings.reduce(
    (sum, row) => sum + Number(row.dividends || 0),
    0,
  );

  const totalReturn = holdings.reduce(
    (sum, row) => sum + Number(row.total_return || 0),
    0,
  );

  const closingChange =
    Number(summary.closing_value || 0) - Number(summary.opening_value || 0);

  const closingChangePct =
    Number(summary.opening_value || 0) > 0
      ? (closingChange / Number(summary.opening_value)) * 100
      : 0;

  const capitalGainPct =
    Number(summary.opening_value || 0) > 0
      ? (Number(summary.capital_gain || 0) / Number(summary.opening_value)) *
        100
      : 0;

  const dividendYieldPct =
    Number(summary.opening_value || 0) > 0
      ? (Number(summary.dividend_income || 0) / Number(summary.opening_value)) *
        100
      : 0;

  return (
    <Box className="performance-page">
      <div className="content-wrapper">
        <div className="tool-hero">
          <div>
            <p className="tool-hero-title">Performance Report</p>
            <p className="tool-hero-subtitle">
              Track portfolio growth, dividends, realised gains, and overall
              return across the selected financial year.
            </p>
          </div>

          <div className="tool-badge">
            {loading ? (
              <Skeleton variant="text" width={150} height={28} />
            ) : performance?.meta?.from_date && performance?.meta?.to_date ? (
              `${performance.meta.from_date} → ${performance.meta.to_date}`
            ) : (
              "Performance"
            )}
          </div>
        </div>

        <Box className="tool-grid">
          {loading ? (
            renderSkeletonCards()
          ) : (
            <>
              <Paper className="tool-card">
                <Typography className="tool-label">Opening Value</Typography>
                <Typography className="tool-value">
                  {money(summary.opening_value)}
                </Typography>
                <Typography className="tool-subtext">
                  Start of report period
                </Typography>
              </Paper>

              <Paper className="tool-card">
                <Typography className="tool-label">Closing Value</Typography>
                <Typography
                  className={
                    "tool-value " +
                    (closingChange >= 0 ? "positive-value" : "negative-value")
                  }
                >
                  {money(summary.closing_value)}
                </Typography>
                <Typography
                  className={
                    "tool-subtext " +
                    (closingChange >= 0 ? "positive-value" : "negative-value")
                  }
                >
                  {closingChange >= 0 ? "+" : ""}
                  {closingChangePct.toFixed(2)}%
                </Typography>
              </Paper>

              <Paper className="tool-card clickable">
                <Typography className="tool-label">Total Return</Typography>
                <Typography
                  className={
                    "tool-value " +
                    (Number(summary.total_return || 0) >= 0
                      ? "positive-value"
                      : "negative-value")
                  }
                >
                  {money(summary.total_return)}
                </Typography>
                <Typography
                  className={
                    "tool-subtext " +
                    (Number(summary.total_return_pct || 0) >= 0
                      ? "positive-value"
                      : "negative-value")
                  }
                >
                  {Number(summary.total_return_pct || 0) >= 0 ? "+" : ""}
                  {Number(summary.total_return_pct || 0).toFixed(2)}%
                </Typography>
              </Paper>

              <Paper className="tool-card">
                <Typography className="tool-label">Capital Gain</Typography>
                <Typography
                  className={
                    "tool-value " +
                    (Number(summary.capital_gain || 0) >= 0
                      ? "positive-value"
                      : "negative-value")
                  }
                >
                  {money(summary.capital_gain)}
                </Typography>
                <Typography
                  className={
                    "tool-subtext " +
                    (Number(summary.capital_gain || 0) >= 0
                      ? "positive-value"
                      : "negative-value")
                  }
                >
                  {Number(summary.capital_gain || 0) >= 0 ? "+" : ""}
                  {capitalGainPct.toFixed(2)}%
                </Typography>
              </Paper>

              <Paper className="tool-card">
                <Typography className="tool-label">Dividends</Typography>
                <Typography className="tool-value">
                  {money(summary.dividend_income)}
                </Typography>
                <Typography className="tool-subtext positive-value">
                  +{dividendYieldPct.toFixed(2)}% yield
                </Typography>
              </Paper>
            </>
          )}
        </Box>

        <Paper className="tool-panel">
          <div className="tool-panel-header">
            <div>
              <Typography className="tool-panel-title">
                Portfolio Performance
              </Typography>
              <p className="tool-panel-subtitle">
                {loading ? (
                  <Skeleton variant="text" width={180} height={24} />
                ) : (
                  <>
                    {performance?.meta?.from_date || "-"} →{" "}
                    {performance?.meta?.to_date || "-"}
                  </>
                )}
              </p>
            </div>

            <span
              className={
                "tool-status-badge " +
                (Number(summary.total_return || 0) >= 0
                  ? "positive-value"
                  : "negative-value")
              }
            >
              {loading ? (
                <Skeleton variant="text" width={80} height={24} />
              ) : (
                <>
                  {Number(summary.total_return || 0) >= 0 ? "↑" : "↓"}{" "}
                  {Number(summary.total_return_pct || 0).toFixed(2)}%
                </>
              )}
            </span>
          </div>

          <Box sx={{ width: "100%", mt: 3 }}>
            {loading ? (
              <Skeleton
                variant="rounded"
                width="100%"
                height={320}
                sx={{ borderRadius: "18px" }}
              />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbe3f0" />

                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tickFormatter={(date) => dayjs(date).format("MMM D")}
                  />

                  <YAxis stroke="#94a3b8" domain={[0, "auto"]} />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e7ebf3",
                      borderRadius: "14px",
                      boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
                    }}
                    formatter={(value) => [money(value), "Portfolio"]}
                    labelFormatter={(label) =>
                      dayjs(label).format("DD MMM YYYY")
                    }
                  />

                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#4f7cff"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#4f7cff" }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            mt={4}
            flexWrap="wrap"
          >
            {["1D", "1W", "1M", "1Y", "ALL"].map((range) => (
              <Button
                key={range}
                className={
                  granularity === range ? "range-button active" : "range-button"
                }
                onClick={() => setGranularity(range)}
                disabled={loading}
              >
                {range}
              </Button>
            ))}
          </Stack>
        </Paper>

        <div className="tool-table-card">
          <div className="table-top-bar">
            <div>
              <h3 className="tool-panel-title">Holdings Breakdown</h3>
            </div>

            <div className="table-filter-group">
              <select className="table-filter" disabled={loading}>
                <option>All stocks</option>
                {holdings.map((row) => (
                  <option key={row.symbol}>{row.symbol}</option>
                ))}
              </select>

              <select className="table-filter" disabled={loading}>
                <option>All results</option>
                <option>Gain only</option>
                <option>Loss only</option>
              </select>

              <div className="table-action-group">
                <span>
                  {loading ? (
                    <Skeleton variant="text" width={70} height={24} />
                  ) : (
                    `${holdings.length} records`
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="tool-table performance-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Qty</th>
                  <th>Cost Base</th>
                  <th>Market Value</th>
                  <th>Capital Gain</th>
                  <th>Dividends</th>
                  <th>Total Return</th>
                  <th>Return %</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  renderSkeletonRows()
                ) : holdings.length === 0 ? (
                  <tr>
                    <td colSpan="8">No holdings found.</td>
                  </tr>
                ) : (
                  holdings.map((row) => (
                    <tr key={row.symbol}>
                      <td>{row.symbol}</td>
                      <td>{row.quantity}</td>
                      <td>{money(row.cost_base)}</td>
                      <td>{money(row.market_value)}</td>

                      <td
                        className={
                          Number(row.capital_gain || 0) >= 0
                            ? "positive-value"
                            : "negative-value"
                        }
                      >
                        {money(row.capital_gain)}
                      </td>

                      <td>{money(row.dividends)}</td>

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
                        {Number(row.return_pct || 0).toFixed(2)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {!loading && holdings.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td></td>
                    <td>{money(totalCostBase)}</td>
                    <td>{money(totalMarketValue)}</td>
                    <td>{money(totalCapitalGain)}</td>
                    <td>{money(totalDividends)}</td>
                    <td>{money(totalReturn)}</td>
                    <td>{Number(summary.total_return_pct || 0).toFixed(2)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </Box>
  );
};

export default PerformancePage;