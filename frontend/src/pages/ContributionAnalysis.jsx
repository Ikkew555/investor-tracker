import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Skeleton, Alert } from "@mui/material";

import "../components/tools-theme.css";

import { getContributionAnalysis } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const ContributionAnalysis = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const chartColors = ["#4f7cff", "#4caf50", "#ff9800", "#64b5f6", "#f44336"];

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["contribution-analysis", userId],
    queryFn:  () => getContributionAnalysis(userId),
    staleTime: 1_200_000, // 20 min — Group A engine
    enabled:  !authLoading && !!userId,
  });

  const warning = result?.warning || null;
  const { data, summary, holdings, sectorData, assetTypeData } = useMemo(() => {
    const rows        = result?.data ?? [];
    const holdingRows = rows.filter(r => r.group_type === 'holding');
    const sectorRows  = rows.filter(r => r.group_type === 'sector');
    const assetRows   = rows.filter(r => r.group_type === 'asset_type');

    const portfolio_return_pct = holdingRows.reduce((s, r) => s + parseFloat(r.contribution_pct || 0), 0);
    const sorted = [...holdingRows].sort((a, b) => parseFloat(b.contribution_pct || 0) - parseFloat(a.contribution_pct || 0));
    const best  = sorted[0]                 || null;
    const worst = sorted[sorted.length - 1] || null;

    const by_sector = {};
    sectorRows.forEach(r => { by_sector[r.group_value] = { contribution_pct: parseFloat(r.contribution_pct || 0), total_return: parseFloat(r.total_return || 0), weight_pct: parseFloat(r.weight_pct || 0) }; });
    const by_asset_type = {};
    assetRows.forEach(r => { by_asset_type[r.group_value] = { contribution_pct: parseFloat(r.contribution_pct || 0), total_return: parseFloat(r.total_return || 0), weight_pct: parseFloat(r.weight_pct || 0) }; });

    const derivedSummary = {
      portfolio_return_pct,
      best_contributor:  best  ? { symbol: best.symbol,  contribution_pct: parseFloat(best.contribution_pct  || 0) } : null,
      worst_contributor: worst ? { symbol: worst.symbol, contribution_pct: parseFloat(worst.contribution_pct || 0) } : null,
    };

    return {
      data:        { summary: derivedSummary, holdings: holdingRows, by_sector, by_asset_type },
      summary:     derivedSummary,
      holdings:    holdingRows,
      sectorData:  sectorRows.map(r => ({ name: r.group_value, value: parseFloat(r.contribution_pct || 0) })),
      assetTypeData: assetRows.map(r => ({ name: r.group_value, value: parseFloat(r.contribution_pct || 0) })),
    };
  }, [result]);

  const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;

  const renderSkeletonCards = () =>
    Array.from({ length: 3 }).map((_, index) => (
      <div className="tool-card" key={index}>
        <Skeleton variant="text" width={140} height={26} />
        <Skeleton variant="text" width={100} height={40} />
        <Skeleton variant="text" width={90} height={24} />
      </div>
    ));

  const renderSkeletonRows = () =>
    Array.from({ length: 5 }).map((_, rowIndex) => (
      <tr key={rowIndex}>
        {Array.from({ length: 6 }).map((__, cellIndex) => (
          <td key={cellIndex}>
            <Skeleton variant="text" height={30} />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="tool-page">
      <div className="tool-hero">
        <div>
          <p className="tool-hero-title">Contribution Analysis</p>
          <p className="tool-hero-subtitle">
            See which holdings contributed most to your portfolio return.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={120} height={28} />
          ) : (
            "Portfolio impact"
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

      <div className="tool-grid">
        {loading ? (
          renderSkeletonCards()
        ) : (
          <>
            <div className="tool-card">
              <p className="tool-label">Portfolio Return</p>
              <h3 className="tool-value positive-value">
                {formatPercent(summary?.portfolio_return_pct)}
              </h3>
              <span className="tool-subtext positive-value">
                Overall result
              </span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Best Contributor</p>
              <h3 className="tool-value positive-value">
                {summary?.best_contributor?.symbol || "-"}
              </h3>
              <span className="tool-subtext positive-value">
                +{formatPercent(summary?.best_contributor?.contribution_pct)}
              </span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Worst Contributor</p>
              <h3 className="tool-value">
                {summary?.worst_contributor?.symbol || "-"}
              </h3>
              <span className="tool-subtext negative-value">
                {formatPercent(summary?.worst_contributor?.contribution_pct)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="tool-panel">
        <h3 className="tool-panel-title">Contribution by Holding</h3>

        {loading ? (
          <Skeleton
            variant="rounded"
            width="100%"
            height={320}
            sx={{ borderRadius: "18px" }}
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={holdings}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
            >
              <XAxis
                type="number"
                tickFormatter={(value) => `${value}%`}
                stroke="currentColor"
              />

              <YAxis
                dataKey="symbol"
                type="category"
                width={60}
                stroke="currentColor"
              />

              <Tooltip
                formatter={(value) => [
                  `${Number(value).toFixed(2)}%`,
                  "Contribution",
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #ddd",
                }}
              />

              <Bar
                dataKey="contribution_pct"
                fill="#4f7cff"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="tool-chart-grid">
        <div className="tool-panel">
          <h3 className="tool-panel-title">By Sector</h3>

          {loading ? (
            <Skeleton
              variant="circular"
              width={220}
              height={220}
              sx={{ margin: "0 auto" }}
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sectorData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {sectorData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(2)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="tool-legend-list">
                {sectorData.map((item, index) => (
                  <div key={item.name} className="tool-legend-row">
                    <span
                      className="tool-legend-dot"
                      style={{
                        backgroundColor:
                          chartColors[index % chartColors.length],
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{formatPercent(item.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="tool-panel">
          <h3 className="tool-panel-title">By Asset Type</h3>

          {loading ? (
            <Skeleton
              variant="circular"
              width={220}
              height={220}
              sx={{ margin: "0 auto" }}
            />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={assetTypeData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {assetTypeData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(2)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="tool-legend-list">
                {assetTypeData.map((item, index) => (
                  <div key={item.name} className="tool-legend-row">
                    <span
                      className="tool-legend-dot"
                      style={{
                        backgroundColor:
                          chartColors[index % chartColors.length],
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{formatPercent(item.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tool-table-card">
        <div className="table-top-bar">
          <div className="table-filter-group">
            <select className="table-filter" disabled={loading}>
              <option>All sectors</option>

              {Object.keys(data?.by_sector || {}).map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </select>

            <select className="table-filter" disabled={loading}>
              <option>All holdings</option>

              {holdings.map((row) => (
                <option key={row.symbol}>{row.symbol}</option>
              ))}
            </select>
          </div>

          <div className="table-action-group">
            <span>
              {loading ? (
                <Skeleton variant="text" width={80} height={24} />
              ) : (
                `${holdings.length} records`
              )}
            </span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="tool-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Sector</th>
                <th>Weight</th>
                <th>Return</th>
                <th>Contribution</th>
                <th>Total Return</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : holdings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="tool-empty">
                    No contribution data
                  </td>
                </tr>
              ) : (
                holdings.map((row) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td>{row.sector}</td>
                    <td>{formatPercent(row.weight_pct)}</td>
                    <td>{formatPercent(row.return_pct)}</td>

                    <td
                      className={
                        Number(row.contribution_pct || 0) >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {formatPercent(row.contribution_pct)}
                    </td>

                    <td>{money(row.total_return)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ContributionAnalysis;
