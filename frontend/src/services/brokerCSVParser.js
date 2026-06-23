const safeText = (value) => String(value || "").trim();

const safeLower = (value) => safeText(value).toLowerCase();

const toNumber = (value) => {
  const cleaned = safeText(value).replace(/[$,%(),]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

const toNullableNumber = (value) => {
  const text = safeText(value);
  if (!text) return null;

  const cleaned = text.replace(/[$,%(),]/g, "");
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
};

const getFirstNumber = (row, keys) => {
  for (const key of keys) {
    const value = toNullableNumber(row[key]);
    if (value !== null) return value;
  }

  return null;
};

const calculateFrankingPercent = (cashAmount, frankingCredits) => {
  const cash = Number(cashAmount || 0);
  const credits = Number(frankingCredits || 0);

  if (cash <= 0 || credits <= 0) return null;

  const companyTaxRate = 0.3;
  const percent = credits / ((cash + credits) * companyTaxRate);

  return Number.isFinite(percent) ? Math.round(percent * 100) : null;
};

const getExtraActivityFields = (row) => {
  const frankingCredits = getFirstNumber(row, [
    "Franking Credit (AUD)",
    "Franking Credits",
    "Franking Credit",
    "Franking Credit Amount",
    "Franked Amount",
  ]);

  const cashAmount = getFirstNumber(row, [
    "Total Dividend (AUD)",
    "Total Dividend",
    "Dividend Amount",
    "Cash Amount",
    "Amount",
    "Net Amount",
  ]);

  const frankingPercent =
    getFirstNumber(row, [
      "Franking Percent",
      "Franking %",
      "Franked %",
      "Franking percentage",
      "Franking Percentage",
    ]) ?? calculateFrankingPercent(cashAmount, frankingCredits);

  const reducedCostBase = getFirstNumber(row, [
    "Reduced Cost Base",
    "Reduced cost base",
    "Reduced Cost",
  ]);

  return {
    frankingPercent,
    frankingCredits,
    reducedCostBase,
  };
};

const toIsoDate = (value) => {
  const text = safeText(value);

  if (!text) return null;

  const dateOnly = text.split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateOnly)) {
    const [day, month, year] = dateOnly.split("/");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const normaliseBrokerName = (brokerName) => {
  const name = safeLower(brokerName);

  if (name.includes("commsec")) return "commsec";
  if (name.includes("nab")) return "nabtrade";
  if (name.includes("selfwealth")) return "selfwealth";
  if (name.includes("webull")) return "webull";

  return "";
};

const hasHeaders = (row, headers) =>
  headers.every((header) => Object.prototype.hasOwnProperty.call(row, header));

const detectCsvBroker = (firstRow = {}) => {
  if (
    hasHeaders(firstRow, [
      "Date",
      "Code",
      "Buy/Sell",
      "Quantity",
      "Price",
      "Consideration",
    ])
  ) {
    return "commsec";
  }

  if (
    hasHeaders(firstRow, [
      "Confirmation No",
      "Trade date",
      "Security code",
      "Buy/Sell",
      "Quantity",
      "Price",
    ])
  ) {
    return "nabtrade";
  }

  if (
    hasHeaders(firstRow, [
      "Date",
      "Type",
      "Market",
      "Code",
      "Quantity",
      "Price ($)",
    ])
  ) {
    return "selfwealth";
  }

  if (
    hasHeaders(firstRow, [
      "Order No",
      "Order Time (AEST)",
      "Symbol",
      "Side",
      "Filled Qty",
      "Avg Fill Price (AUD)",
    ])
  ) {
    return "webull";
  }

  if (
    hasHeaders(firstRow, [
      "Record No",
      "Payment Date (AEST)",
      "Symbol",
      "Dividend Per Share (AUD)",
      "Shares Held",
      "Total Dividend (AUD)",
    ])
  ) {
    return "webull";
  }

  if (
    hasHeaders(firstRow, [
      "Record No",
      "Time (AEST)",
      "Type",
      "Symbol",
      "Amount (AUD)",
    ])
  ) {
    return "webull";
  }

  return "unknown";
};

const normaliseType = (value) => {
  const type = safeLower(value);

  if (["b", "buy"].includes(type)) return "Buy";
  if (["s", "sell"].includes(type)) return "Sell";
  if (type.includes("dividend")) return "Dividend";
  if (type.includes("deposit")) return "Deposit";
  if (type.includes("withdraw")) return "Withdrawal";
  if (type.includes("fee")) return "Fee";
  if (type.includes("commission")) return "Commission";

  return safeText(value) || "Unknown";
};

const parseCommSecRow = (row) => ({
  type: normaliseType(row["Buy/Sell"]),
  date: toIsoDate(row["Date"]),
  symbol: safeText(row["Code"]).toUpperCase(),
  securityName: safeText(row["Description"]) || safeText(row["Code"]),
  market: "ASX",
  quantity: toNumber(row["Quantity"]),
  price: toNumber(row["Price"]),
  fees: toNumber(row["Brokerage"]),
  currency: "AUD",
  totalAmount: toNumber(row["Consideration"]),
  reference: safeText(row["Contract Note"]),
  ...getExtraActivityFields(row),
});

const parseNabTradeRow = (row) => ({
  type: normaliseType(row["Buy/Sell"]),
  date: toIsoDate(row["Trade date"]),
  symbol: safeText(row["Security code"]).toUpperCase(),
  securityName:
    safeText(row["Security name"]) || safeText(row["Security code"]),
  market: "ASX",
  quantity: toNumber(row["Quantity"]),
  price: toNumber(row["Price"]),
  fees: toNumber(row["Brokerage (incl. GST)"]),
  currency: "AUD",
  totalAmount: toNumber(row["Settl. value"]),
  reference: safeText(row["Confirmation No"]),
  ...getExtraActivityFields(row),
});

const parseSelfwealthRow = (row) => ({
  type: normaliseType(row["Type"]),
  date: toIsoDate(row["Date"]),
  symbol: safeText(row["Code"]).toUpperCase(),
  securityName: safeText(row["Security"]) || safeText(row["Code"]),
  market: safeText(row["Market"]) || "ASX",
  quantity: toNumber(row["Quantity"]),
  price: toNumber(row["Price ($)"]),
  fees: toNumber(row["Brokerage ($)"]),
  currency: "AUD",
  totalAmount: toNumber(row["Net Consideration ($)"]),
  reference: safeText(row["Order Reference"]),
  ...getExtraActivityFields(row),
});

const parseWebullOrderRow = (row) => ({
  type: normaliseType(row["Side"]),
  date: toIsoDate(row["Order Time (AEST)"]),
  symbol: safeText(row["Symbol"]).toUpperCase(),
  securityName: safeText(row["Symbol"]),
  market: "ASX",
  quantity: toNumber(row["Filled Qty"]),
  price: toNumber(row["Avg Fill Price (AUD)"]),
  fees: 0,
  currency: "AUD",
  totalAmount: toNumber(row["Order Amt (AUD)"]),
  reference: safeText(row["Order No"]),
  ...getExtraActivityFields(row),
});

const parseWebullDividendRow = (row) => ({
  type: "Dividend",
  date: toIsoDate(row["Payment Date (AEST)"]),
  symbol: safeText(row["Symbol"]).toUpperCase(),
  securityName: safeText(row["Symbol"]),
  market: "ASX",
  quantity: toNumber(row["Shares Held"]),
  price: toNumber(row["Dividend Per Share (AUD)"]),
  fees: 0,
  currency: "AUD",
  totalAmount: toNumber(row["Total Dividend (AUD)"]),
  frankingCredits: toNumber(row["Franking Credit (AUD)"]) || null,
  grossAmount: toNumber(row["Gross Amount (AUD)"]) || null,
  reference: safeText(row["Record No"]),
});

const parseWebullFundsRow = (row) => ({
  type: normaliseType(row["Type"]),
  date: toIsoDate(row["Time (AEST)"]),
  symbol: safeText(row["Symbol"]).toUpperCase(),
  securityName: safeText(row["Symbol"]),
  market: "ASX",
  quantity: 0,
  price: 0,
  fees: 0,
  currency: "AUD",
  totalAmount: toNumber(row["Amount (AUD)"]),
  reference: safeText(row["Record No"]),
  ...getExtraActivityFields(row),
});

export function parseBrokerCsvRows(rows, selectedBrokerName) {
  const cleanRows = rows.filter((row) =>
    Object.values(row || {}).some((value) => safeText(value) !== ""),
  );

  if (cleanRows.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const selectedBroker = normaliseBrokerName(selectedBrokerName);
  const detectedBroker = detectCsvBroker(cleanRows[0]);

  if (!selectedBroker) {
    throw new Error(
      "Broker provider is missing. Please reopen this broker page.",
    );
  }

  if (detectedBroker === "unknown") {
    throw new Error(
      "Unsupported CSV format. Please upload a supported CommSec, NABTrade, Selfwealth, or Webull CSV file.",
    );
  }

  if (selectedBroker !== detectedBroker) {
    throw new Error(
      `This looks like a ${detectedBroker.toUpperCase()} CSV, but you selected ${selectedBroker.toUpperCase()}.`,
    );
  }

  return cleanRows
    .map((row) => {
      if (detectedBroker === "commsec") return parseCommSecRow(row);
      if (detectedBroker === "nabtrade") return parseNabTradeRow(row);
      if (detectedBroker === "selfwealth") return parseSelfwealthRow(row);

      if (detectedBroker === "webull") {
        if (row["Order No"]) return parseWebullOrderRow(row);
        if (row["Payment Date (AEST)"]) return parseWebullDividendRow(row);
        if (row["Time (AEST)"]) return parseWebullFundsRow(row);
      }

      return null;
    })
    .filter(Boolean)
    .filter((row) => row.date && (row.symbol || row.type === "Fee"));
}
