import React, { useMemo } from "react";
import { Box, Paper, Typography, Skeleton, Alert } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import "../components/tools-theme.css";

import { getFutureIncome } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const FutureIncome = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["future-income", userId],
    queryFn:  () => getFutureIncome(userId),
    staleTime: 43_200_000, // 12 h — Group C engine
    enabled:  !authLoading && !!userId,
  });

  const forecast = result?.data ?? [];
  const warning  = result?.warning || null;
  const summary  = useMemo(() => {
    const total_annual_income = forecast.reduce((s, r) => s + parseFloat(r.annual_income || 0), 0);
    const average_yield_pct   = forecast.length > 0
      ? forecast.reduce((s, r) => s + parseFloat(r.yield_pct || 0), 0) / forecast.length
      : 0;
    const symbols_with_income = forecast.filter(r => parseFloat(r.annual_income || 0) > 0).length;
    return { total_annual_income, average_yield_pct, symbols_with_income };
  }, [forecast]);

  const totalAnnualIncome = Number(summary?.total_annual_income || 0);
  const averageYield = Number(summary?.average_yield_pct || 0);
  const symbolsWithIncome = Number(summary?.symbols_with_income || 0);

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const getStatus = (date) => {
    const today = new Date();
    const payment = new Date(date);

    if (payment < today) return "Completed";

    const diffDays = (payment - today) / (1000 * 60 * 60 * 24);

    if (diffDays < 30) return "Upcoming";

    return "Estimated";
  };

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderSkeletonCards = () =>
    Array.from({ length: 3 }).map((_, index) => (
      <Paper className="tool-card" key={index}>
        <Skeleton variant="text" width={140} height={26} />
        <Skeleton variant="text" width={120} height={42} />
        <Skeleton variant="text" width={100} height={22} />
      </Paper>
    ));

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: 6 }).map((__, cellIndex) => (
          <td key={cellIndex}>
            <Skeleton variant="text" height={32} />
          </td>
        ))}
      </tr>
    ));

  return (
    <Box className="tool-page">
      <div className="tool-hero">
        <div>
          <p className="tool-hero-title">Future Income</p>
          <p className="tool-hero-subtitle">
            Estimate upcoming dividend income, yield, and income-producing
            holdings.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={120} height={28} />
          ) : (
            "Next 12 months"
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

      <Box className="tool-grid">
        {loading ? (
          renderSkeletonCards()
        ) : (
          <>
            <Paper className="tool-card">
              <Typography className="tool-label">
                Total Annual Income
              </Typography>
              <Typography className="tool-value">
                {money(totalAnnualIncome)}
              </Typography>
              <Typography className="tool-subtext">Projected income</Typography>
            </Paper>

            <Paper className="tool-card">
              <Typography className="tool-label">Average Yield</Typography>
              <Typography className="tool-value">
                {averageYield.toFixed(2)}%
              </Typography>
              <Typography className="tool-subtext">Portfolio yield</Typography>
            </Paper>

            <Paper className="tool-card">
              <Typography className="tool-label">Income Holdings</Typography>
              <Typography className="tool-value">
                {symbolsWithIncome}
              </Typography>
              <Typography className="tool-subtext">Paying symbols</Typography>
            </Paper>
          </>
        )}
      </Box>

      <div className="tool-table-card">
        <div className="table-top-bar">
          <div className="table-filter-group">
            <select className="table-filter" disabled={loading}>
              <option>All symbols</option>
              {forecast.map((row) => (
                <option key={row.symbol}>{row.symbol}</option>
              ))}
            </select>

            <select className="table-filter" disabled={loading}>
              <option>All status</option>
              <option>Completed</option>
              <option>Upcoming</option>
              <option>Estimated</option>
            </select>
          </div>

          <div className="table-action-group">
            <span>
              {loading ? (
                <Skeleton variant="text" width={80} height={24} />
              ) : (
                `${forecast.length} records`
              )}
            </span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Last Payment</th>
                <th>Annual Income</th>
                <th>Yield</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : forecast.length === 0 ? (
                <tr>
                  <td colSpan="6" className="tool-empty">
                    No upcoming income
                  </td>
                </tr>
              ) : (
                forecast.map((row, i) => {
                  const status = getStatus(row.last_payment_date);

                  return (
                    <tr key={`${row.symbol}-${i}`}>
                      <td>{row.symbol || "-"}</td>
                      <td>{row.quantity || 0}</td>
                      <td>{formatDate(row.last_payment_date)}</td>
                      <td className="amount-cell">
                        {money(row.annual_income)}
                      </td>
                      <td className="positive-value">
                        +{Number(row.yield_pct || 0).toFixed(2)}%
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            status === "Completed"
                              ? "status-complete"
                              : status === "Upcoming"
                                ? "status-upcoming"
                                : "status-estimated"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Box>
  );
};

export default FutureIncome;
