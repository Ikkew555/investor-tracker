export function formatValue(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : value.toFixed(2);
  }
  return value;
}

export function formatLabel(text) {
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Detect which columns are date strings (YYYY-MM-DD).
 * Returns a Set of column names.
 */
export function detectDateColumns(data) {
  if (!data || data.length === 0) return new Set();
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const cols = Object.keys(data[0]);
  return new Set(cols.filter((col) => dateRe.test(String(data[0][col] ?? ""))));
}

/**
 * Detect which columns are purely numeric.
 * Returns a Set of column names.
 */
export function detectNumericColumns(data) {
  if (!data || data.length === 0) return new Set();
  const cols = Object.keys(data[0]);
  return new Set(
    cols.filter((col) => data.every((row) => row[col] === null || row[col] === undefined || typeof row[col] === "number"))
  );
}

/**
 * Apply filters and sort to an array of objects.
 *
 * @param {object[]} data       - raw array
 * @param {object}   filters    - { columnFilters: {col: value}, dateRanges: {col: {from, to}}, numericRanges: {col: {min, max}} }
 * @param {object|null} sort    - { key: string, dir: 1 | -1 } or null
 * @returns {object[]} filtered + sorted copy
 */
export function applyFiltersAndSort(data, filters, sort) {
  let result = [...data];

  // Column value filters (exact match, case-insensitive for strings)
  if (filters.columnFilters) {
    for (const [col, val] of Object.entries(filters.columnFilters)) {
      if (val === "" || val === null || val === undefined) continue;
      result = result.filter((row) => String(row[col]).toLowerCase() === String(val).toLowerCase());
    }
  }

  // Date range filters
  if (filters.dateRanges) {
    for (const [col, range] of Object.entries(filters.dateRanges)) {
      if (range.from) result = result.filter((row) => String(row[col]) >= range.from);
      if (range.to)   result = result.filter((row) => String(row[col]) <= range.to);
    }
  }

  // Numeric range filters
  if (filters.numericRanges) {
    for (const [col, range] of Object.entries(filters.numericRanges)) {
      if (range.min !== "" && range.min !== null && range.min !== undefined) {
        result = result.filter((row) => Number(row[col]) >= Number(range.min));
      }
      if (range.max !== "" && range.max !== null && range.max !== undefined) {
        result = result.filter((row) => Number(row[col]) <= Number(range.max));
      }
    }
  }

  // Sort
  if (sort && sort.key) {
    result.sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return -sort.dir;
      if (av > bv) return sort.dir;
      return 0;
    });
  }

  return result;
}