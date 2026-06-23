const TimeFilters = () => (
  <div className="flex flex-wrap gap-2">
    {["1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "ALL"].map((filter) => (
      <button
        key={filter}
        className="px-3 py-1 border text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        {filter}
      </button>
    ))}
  </div>
);

  export default TimeFilters;