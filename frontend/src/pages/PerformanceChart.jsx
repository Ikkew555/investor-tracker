import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="performance-tooltip">
      <p className="tooltip-date">{label}</p>
      <p className="tooltip-value">Value: {formatCurrency(payload[0].value)}</p>
    </div>
  );
};

const PerformanceChart = ({ data, title = "Portfolio Value Over Time" }) => {
  const startValue = data[0]?.value || 0;
  const endValue = data[data.length - 1]?.value || 0;
  const change = endValue - startValue;
  const changePct = startValue ? (change / startValue) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="performance-chart-card">
      <div className="performance-chart-header">
        <div>
          <h2>{title}</h2>
          <p>Estimated movement between report start and end date.</p>
        </div>

        <div
          className={
            isPositive ? "chart-change positive" : "chart-change negative"
          }
        >
          {isPositive ? "+" : ""}
          {formatCurrency(change)} ({isPositive ? "+" : ""}
          {changePct.toFixed(2)}%)
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(date) =>
              new Date(date).toLocaleDateString("en-AU", {
                month: "short",
                year: "2-digit",
              })
            }
          />

          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `$${Number(value / 1000).toFixed(0)}k`}
          />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
