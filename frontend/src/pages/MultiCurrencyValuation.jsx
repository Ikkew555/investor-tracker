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

import { getMultiCurrency } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const MultiCurrencyValuation = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const baseCurrency = "AUD";

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["multi-currency", userId],
    queryFn:  () => getMultiCurrency(userId),
    staleTime: 1_200_000, // 20 min — Group B engine
    enabled:  !authLoading && !!userId,
  });

  const warning = result?.warning || null;
  const { summary, holdings, currencyMap, countryMap, currencyData, countryData } = useMemo(() => {
    const rows        = result?.data ?? [];
    const holdingRows  = rows.filter(r => r.group_type === 'holding');
    const currencyRows = rows.filter(r => r.group_type === 'currency');
    const countryRows  = rows.filter(r => r.group_type === 'country');

    const by_currency = {};
    currencyRows.forEach(r => { by_currency[r.group_value] = { market_value_base: parseFloat(r.market_value_base || 0), weight_pct: parseFloat(r.weight_pct || 0) }; });
    const by_country = {};
    countryRows.forEach(r => { by_country[r.group_value] = { market_value_base: parseFloat(r.market_value_base || 0), weight_pct: parseFloat(r.weight_pct || 0) }; });

    return {
      summary: {
        total_market_value_base: holdingRows.reduce((s, r) => s + parseFloat(r.market_value_base || 0), 0),
        total_investment_gain:   holdingRows.reduce((s, r) => s + parseFloat(r.investment_gain   || 0), 0),
        total_fx_gain:           holdingRows.reduce((s, r) => s + parseFloat(r.fx_gain           || 0), 0),
      },
      holdings: holdingRows.map(r => ({
        ...r,
        parcel_id:       r.buy_id,
        fx_rate_current: parseFloat(r.local_market_value) > 0 && parseFloat(r.market_value_base) > 0
          ? parseFloat(r.local_market_value) / parseFloat(r.market_value_base)
          : null,
      })),
      currencyMap:  by_currency,
      countryMap:   by_country,
      currencyData: currencyRows.map(r => ({ name: r.group_value, weight: parseFloat(r.weight_pct || 0), marketValue: parseFloat(r.market_value_base || 0) })),
      countryData:  countryRows.map(r => ({ name: r.group_value, weight: parseFloat(r.weight_pct || 0), marketValue: parseFloat(r.market_value_base || 0) })),
    };
  }, [result]);

  const money = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: baseCurrency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const renderSkeletonCards = () =>
    Array.from({ length: 3 }).map((_, index) => (
      <div className="tool-card" key={index}>
        <Skeleton variant="text" width={140} height={26} />
        <Skeleton variant="text" width={160} height={42} />
        <Skeleton variant="text" width={100} height={24} />
      </div>
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

  const renderBarPanel = (title, chartData, color) => (
    <div className="tool-panel">
      <h3 className="tool-panel-title">{title}</h3>

      {loading ? (
        <Skeleton
          variant="rounded"
          width="100%"
          height={240}
          sx={{ borderRadius: "18px" }}
        />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                stroke="currentColor"
              />

              <YAxis
                dataKey="name"
                type="category"
                width={70}
                stroke="currentColor"
              />

              <Tooltip
                formatter={(value, name) =>
                  name === "weight"
                    ? [`${Number(value).toFixed(2)}%`, "Weight"]
                    : [money(value), "Market Value"]
                }
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #ddd",
                }}
              />

              <Bar dataKey="weight" fill={color} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="tool-list">
            {chartData.map((item) => (
              <div key={item.name} className="tool-list-row">
                <span>{item.name}</span>

                <strong>{Number(item.weight || 0).toFixed(2)}%</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="tool-page">
      <div className="tool-hero">
        <div>
          <p className="tool-hero-title">Multi-Currency Valuation</p>

          <p className="tool-hero-subtitle">
            View portfolio value by currency and country, including investment
            and FX gain.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={100} height={28} />
          ) : (
            `Base: ${baseCurrency}`
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
              <p className="tool-label">Total Market Value</p>

              <h3 className="tool-value">
                {money(summary.total_market_value_base)}
              </h3>

              <span className="tool-subtext">Base currency</span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Investment Gain</p>

              <h3
                className={
                  "tool-value " +
                  (Number(summary.total_investment_gain || 0) >= 0
                    ? "positive-value"
                    : "negative-value")
                }
              >
                {money(summary.total_investment_gain)}
              </h3>

              <span
                className={
                  "tool-subtext " +
                  (Number(summary.total_investment_gain || 0) >= 0
                    ? "positive-value"
                    : "negative-value")
                }
              >
                Stock movement
              </span>
            </div>

            <div className="tool-card">
              <p className="tool-label">FX Gain</p>

              <h3
                className={
                  "tool-value " +
                  (Number(summary.total_fx_gain || 0) >= 0
                    ? "positive-value"
                    : "negative-value")
                }
              >
                {money(summary.total_fx_gain)}
              </h3>

              <span
                className={
                  "tool-subtext " +
                  (Number(summary.total_fx_gain || 0) >= 0
                    ? "positive-value"
                    : "negative-value")
                }
              >
                Currency movement
              </span>
            </div>
          </>
        )}
      </div>

      <div className="tool-chart-grid">
        {renderBarPanel("By Currency", currencyData, "#4f7cff")}

        {renderBarPanel("By Country", countryData, "#4caf50")}
      </div>

      <div className="tool-table-card">
        <div className="table-top-bar">
          <div className="table-filter-group">
            <select className="table-filter" disabled={loading}>
              <option>All currencies</option>

              {Object.keys(currencyMap).map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>

            <select className="table-filter" disabled={loading}>
              <option>All countries</option>

              {Object.keys(countryMap).map((country) => (
                <option key={country}>{country}</option>
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
                <th>Currency</th>
                <th>Local Value</th>
                <th>FX Now</th>
                <th>Market Value</th>
                <th>Investment Gain</th>
                <th>FX Gain</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows()
              ) : holdings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="tool-empty">
                    No holdings found.
                  </td>
                </tr>
              ) : (
                holdings.map((row) => (
                  <tr key={row.parcel_id}>
                    <td>{row.symbol}</td>
                    <td>{row.currency}</td>

                    <td>
                      {Number(row.local_market_value || 0).toLocaleString()}
                    </td>

                    <td>{Number(row.fx_rate_current || 0).toFixed(2)}</td>

                    <td>{money(row.market_value_base)}</td>

                    <td
                      className={
                        Number(row.investment_gain || 0) >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {money(row.investment_gain)}
                    </td>

                    <td
                      className={
                        Number(row.fx_gain || 0) >= 0
                          ? "positive-value"
                          : "negative-value"
                      }
                    >
                      {money(row.fx_gain)}
                    </td>
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

export default MultiCurrencyValuation;
