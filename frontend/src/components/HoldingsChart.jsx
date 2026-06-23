

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const data = [
  { name: 'Stocks', value: 400 },
  { name: 'ETFs', value: 300 },
  { name: 'Crypto', value: 300 },
];

const COLORS = ['#8884d8', '#82ca9d', '#ffc658'];
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

const ClassChart = () => {
  return (
    <div style={{ textAlign: 'center', width: '100%', height: 300 }}>
      <h3>By Class</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name }) => name}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClassChart;
