

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const COLORS = ['#795548', '#00BCD4', '#FFC107', '#607D8B', '#E91E63'];
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip" style={{ 
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <p style={{ margin: 0 }}><strong>{label}</strong></p>
        <p style={{ margin: 0 }}>Value: {payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};
const TypeChart = ({ data }) => {
  return (
    <div>
      <h3 style={{ textAlign: 'center' }}>By Type</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="value"
            name="Holdings by Type"
            fill={COLORS[2]}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TypeChart;
