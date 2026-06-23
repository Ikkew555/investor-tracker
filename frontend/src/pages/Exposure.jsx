import React, { useEffect, useState } from 'react';

const Exposure = () => {
  const [exposureData, _setExposureData] = useState([]); // Renamed to _setExposureData

  useEffect(() => {
    // fetch("/api/exposure").then(res => res.json()).then(_setExposureData);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Exposure Report</h2>
      <table className="min-w-full table-auto border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">Sector</th>
            <th className="border px-4 py-2">Asset Class</th>
            <th className="border px-4 py-2">Region</th>
            <th className="border px-4 py-2">Weight %</th>
          </tr>
        </thead>
        <tbody>
          {exposureData.length === 0 ? (
            <tr><td colSpan="4" className="text-center py-4">No exposure data</td></tr>
          ) : (
            exposureData.map((row, i) => (
              <tr key={i}>
                <td className="border px-4 py-2">{row.sector}</td>
                <td className="border px-4 py-2">{row.assetClass}</td>
                <td className="border px-4 py-2">{row.region}</td>
                <td className="border px-4 py-2">{row.weight}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Exposure;