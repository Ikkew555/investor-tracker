import React, { useState } from 'react';
import CSVUploader from '../components/CSVUploader';
import ActivityTable from '../components/ActivityTable';

const ActivitiesPage = () => {
  const [data, setData] = useState([]);

  return (
    <div className="min-h-screen bg-[#fdf9f4] p-6 font-mono">
      <h1 className="text-2xl font-bold mb-4">Activity</h1>
      <CSVUploader onUpload={setData} />
      <ActivityTable data={data} />
    </div>
  );
};

export default ActivitiesPage;
