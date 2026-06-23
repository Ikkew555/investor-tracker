import React from 'react';

const badgeColor = (type) => {
  if (type === 'BUY') return 'bg-green-600 text-white';
  if (type === 'SELL') return 'bg-red-600 text-white';
  if (type === 'DEPOSIT') return 'bg-yellow-500 text-white';
  return 'bg-gray-300';
};

const ActivityTable = ({ data }) => {
  if (!data || data.length === 0) return <div>No data uploaded.</div>;

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full bg-white text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            {Object.keys(data[0]).map((key) => (
              <th key={key} className="px-4 py-2 border-b">{key}</th>
            ))}
            <th className="px-4 py-2 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 border-b">
              {Object.entries(row).map(([key, val], j) => {
                if (key === 'Type') {
                  return (
                    <td key={j} className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${badgeColor(val)}`}>
                        {val}
                      </span>
                    </td>
                  );
                }
                if (key === 'Name' && val?.startsWith('$')) {
                  return (
                    <td key={j} className="px-4 py-2">
                      <span className="bg-black text-white text-xs px-2 py-1 rounded">{val}</span>
                    </td>
                  );
                }
                return <td key={j} className="px-4 py-2">{val}</td>;
              })}
              <td className="px-4 py-2 text-right">
                <button className="bg-gray-200 px-2 py-1 rounded">⋮</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


export default ActivityTable;
