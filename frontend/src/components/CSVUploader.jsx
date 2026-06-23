import React from 'react';
import Papa from 'papaparse';

const CSVUploader = ({ onUpload }) => {
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        onUpload(results.data);
      },
    });
  };

  return (
    <div className="flex gap-4 mb-4">
      <label className="bg-black text-white px-4 py-2 rounded cursor-pointer hover:bg-gray-800">
        Upload CSV
        <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
      </label>
      <button className="bg-gray-100 px-4 py-2 rounded border hover:bg-gray-200">Add Manually</button>
    </div>
  );
};


export default CSVUploader;
