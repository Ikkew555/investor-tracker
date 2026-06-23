import {
  IlluCGT,
  IlluDividend,
  IlluParcels,
  IlluSummary,
  IlluMethod,
  IlluErrors,
} from "./Illustrations";

export const REPORTS = [
  // CGT reports
  {
    id: "cgt_events",
    title: "CGT Events",
    subtitle: "Every disposal event with cost base, proceeds, and gain or loss per parcel.",
    Illustration: IlluCGT,
  },
  {
    id: "cgt_summary",
    title: "CGT Summary",
    subtitle: "Aggregated capital gains with 50% discount method applied for ATO reporting.",
    Illustration: IlluSummary,
  },
  {
    id: "method_breakdown",
    title: "Method Breakdown",
    subtitle: "Gains and losses split by CGT method: discount, indexation, and other.",
    Illustration: IlluMethod,
  },

  // Dividend reports
  {
    id: "dividend_events",
    title: "Dividend Events",
    subtitle: "Dividend and interest payments with franking credits and withholding tax.",
    Illustration: IlluDividend,
  },
  {
    id: "dividend_summary",
    title: "Dividend Summary",
    subtitle: "Total taxable income from dividends including all franking credits.",
    Illustration: IlluSummary,
  },
  {
    id: "remaining_parcels",
    title: "Remaining Parcels",
    subtitle: "Open parcels not yet disposed, showing unrealised gain or loss.",
    Illustration: IlluParcels,
  },

  // Other
  {
    id: "disposal_errors",
    title: "Disposal Errors",
    subtitle: "Parcels with missing or inconsistent data that may affect tax accuracy.",
    Illustration: IlluErrors,
  },
];