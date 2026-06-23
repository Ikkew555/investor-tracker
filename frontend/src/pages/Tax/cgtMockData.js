// cgtMockData.js
// Mock CGT data for all ATO-valid parcel matching methods.
// Replace computeByMethod() with a real API call when backend is ready.

const BASE_PARCELS = [
  { parcel_id: "P001", symbol: "CBA", acquired_date: "2021-03-10", units: 200, unit_cost: 73.00, total_cost: 14600 },
  { parcel_id: "P002", symbol: "BHP", acquired_date: "2020-11-05", units: 150, unit_cost: 52.00, total_cost: 7800  },
  { parcel_id: "P003", symbol: "CSL", acquired_date: "2022-06-20", units: 20,  unit_cost: 275.00, total_cost: 5500 },
  { parcel_id: "P004", symbol: "WBC", acquired_date: "2023-01-15", units: 300, unit_cost: 30.00, total_cost: 9000  },
  { parcel_id: "P005", symbol: "TLS", acquired_date: "2023-03-01", units: 500, unit_cost: 3.80,  total_cost: 1900  },
];

const DISPOSALS = [
  { disposal_id: "S001", symbol: "CBA", disposal_date: "2023-09-12", units: 100, proceeds: 8180 },
  { disposal_id: "S002", symbol: "BHP", disposal_date: "2024-01-22", units: 80,  proceeds: 5080 },
  { disposal_id: "S003", symbol: "WBC", disposal_date: "2024-03-05", units: 200, proceeds: 5780 },
  { disposal_id: "S004", symbol: "TLS", disposal_date: "2024-05-10", units: 300, proceeds: 975  },
];

// Parcel selectors per method
function selectParcel(method, parcels, symbol) {
  const candidates = parcels.filter(p => p.symbol === symbol && p.units > 0);
  if (!candidates.length) return null;
  switch (method) {
    case "fifo":          return candidates.sort((a,b) => a.acquired_date.localeCompare(b.acquired_date))[0];
    case "lifo":          return candidates.sort((a,b) => b.acquired_date.localeCompare(a.acquired_date))[0];
    case "highest_cost":  return candidates.sort((a,b) => b.unit_cost - a.unit_cost)[0];
    case "minimise_gain": return candidates.sort((a,b) => a.unit_cost - b.unit_cost)[0]; // highest gain = sell lowest cost first → minimise = sell highest cost
    case "maximise_gain": return candidates.sort((a,b) => a.unit_cost - b.unit_cost)[0]; // sell cheapest = max gain
    default:              return candidates[0];
  }
}

// Corrected logic:
// minimise_gain → sell highest cost basis first (smallest gain / largest loss)
// maximise_gain → sell lowest cost basis first (largest gain)
function selectParcelFixed(method, candidates) {
  if (!candidates.length) return null;
  switch (method) {
    case "fifo":          return [...candidates].sort((a,b) => a.acquired_date.localeCompare(b.acquired_date))[0];
    case "lifo":          return [...candidates].sort((a,b) => b.acquired_date.localeCompare(a.acquired_date))[0];
    case "highest_cost":  return [...candidates].sort((a,b) => b.unit_cost - a.unit_cost)[0];
    case "minimise_gain": return [...candidates].sort((a,b) => b.unit_cost - a.unit_cost)[0];
    case "maximise_gain": return [...candidates].sort((a,b) => a.unit_cost - b.unit_cost)[0];
    default:              return candidates[0];
  }
}

function computeByMethod(method, carryForwardLoss = 0) {
  // Deep-copy parcels so we can mutate remaining units
  const parcels = BASE_PARCELS.map(p => ({ ...p }));

  const events = DISPOSALS.map(d => {
    const candidates = parcels.filter(p => p.symbol === d.symbol && p.units > 0);
    const parcel = selectParcelFixed(method, candidates);
    if (!parcel) return null;

    const unitsUsed   = Math.min(d.units, parcel.units);
    const cost_base   = +(unitsUsed * parcel.unit_cost).toFixed(2);
    const proceeds    = +((d.proceeds / d.units) * unitsUsed).toFixed(2);
    const raw_gain    = +(proceeds - cost_base).toFixed(2);
    const holding_days = Math.round(
      (new Date(d.disposal_date) - new Date(parcel.acquired_date)) / 86400000
    );
    const eligible_discount = holding_days >= 365 && raw_gain > 0;
    const cgt_method   = raw_gain < 0 ? "loss" : eligible_discount ? "discount" : "other";
    const discount_applied = cgt_method === "discount" ? +(raw_gain * 0.5).toFixed(2) : 0;
    const net_gain     = cgt_method === "discount" ? +(raw_gain * 0.5).toFixed(2) : raw_gain > 0 ? raw_gain : 0;
    const capital_loss = raw_gain < 0 ? +Math.abs(raw_gain).toFixed(2) : 0;

    parcel.units -= unitsUsed;

    return {
      parcel_id: parcel.parcel_id,
      disposal_id: d.disposal_id,
      symbol: d.symbol,
      acquired_date: parcel.acquired_date,
      disposal_date: d.disposal_date,
      holding_days,
      units_disposed: unitsUsed,
      cost_base,
      proceeds,
      raw_gain,
      cgt_method,
      discount_applied,
      net_gain,
      capital_loss,
      is_loss: raw_gain < 0,
    };
  }).filter(Boolean);

  const total_gross_gains        = +events.filter(e => e.raw_gain > 0).reduce((s,e) => s + e.raw_gain, 0).toFixed(2);
  const total_discount_applied   = +events.reduce((s,e) => s + e.discount_applied, 0).toFixed(2);
  const total_net_after_discount = +(total_gross_gains - total_discount_applied).toFixed(2);
  const total_losses             = +events.reduce((s,e) => s + e.capital_loss, 0).toFixed(2);
  const prior_loss_applied       = +Math.min(carryForwardLoss, total_net_after_discount).toFixed(2);
  const net_capital_gain         = +Math.max(0, total_net_after_discount - total_losses - prior_loss_applied).toFixed(2);
  const new_carry_forward        = +Math.max(0, total_losses + carryForwardLoss - total_net_after_discount).toFixed(2);

  return {
    cgt_events: events,
    cgt_summary: {
      total_gross_gains,
      total_cgt_discount_applied:    total_discount_applied,
      total_net_gains_after_discount: total_net_after_discount,
      total_capital_losses:          total_losses,
      prior_year_carried_forward_loss_applied: prior_loss_applied,
      net_capital_gain,
      new_carried_forward_loss:      new_carry_forward,
    },
  };
}

export const ATO_METHODS = [
  { id: "fifo",          label: "FIFO",          desc: "First In, First Out — oldest parcels sold first. ATO default." },
  { id: "lifo",          label: "LIFO",          desc: "Last In, First Out — most recently acquired parcels sold first." },
  { id: "highest_cost",  label: "Highest Cost",  desc: "Sell the highest cost-basis parcels first to minimise gains." },
  { id: "minimise_gain", label: "Minimise Gain", desc: "Prioritises parcels that reduce your total net capital gain." },
  { id: "maximise_gain", label: "Maximise Gain", desc: "Prioritises parcels that maximise gains (e.g. to use up losses)." },
];

export { computeByMethod };