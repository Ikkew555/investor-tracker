// Illustrations.jsx — SVG illustration components for each tax report card.
// Each receives a `colors` prop from the theme so they always render correctly.

import React from "react";

export function IlluCGT({ colors }) {
  const { illBg, ill1, ill2, ill3, ill4 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      <rect x="24" y="20" width="172" height="14" rx="3" fill={ill1} />
      <rect x="24" y="40" width="172" height="10" rx="3" fill={ill2} opacity="0.7" />
      <rect x="24" y="56" width="140" height="10" rx="3" fill={ill2} opacity="0.5" />
      <rect x="24" y="72" width="156" height="10" rx="3" fill={ill2} opacity="0.4" />
      <rect x="24" y="88" width="120" height="10" rx="3" fill={ill2} opacity="0.3" />
      <rect x="24" y="40" width="4" height="58" rx="2" fill={ill3} />
      <circle cx="170" cy="100" r="26" fill={ill1} />
      <circle cx="170" cy="100" r="18" fill={ill2} />
      <text x="170" y="106" textAnchor="middle" fontSize="16" fill={ill4} fontWeight="bold">$</text>
    </svg>
  );
}

export function IlluDividend({ colors }) {
  const { illBg, ill1, ill2, ill4 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      <circle cx="86"  cy="72" r="46" fill={ill1} opacity="0.9" />
      <circle cx="134" cy="72" r="46" fill={ill2} opacity="0.9" />
      <circle cx="86"  cy="72" r="46" fill={ill1} opacity="0.4" />
      <text x="70"  y="78" textAnchor="middle" fontSize="22" fill={ill4} fontWeight="bold">$</text>
      <text x="150" y="78" textAnchor="middle" fontSize="22" fill={ill4} fontWeight="bold">%</text>
    </svg>
  );
}

export function IlluParcels({ colors }) {
  const { illBg, ill2, ill3 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      {[0, 1, 2, 3].map((col) =>
        [0, 1, 2, 3].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={46 + col * 34} y={18 + row * 28}
            width={26} height={20} rx="3"
            fill={ill2}
            opacity={0.3 + (col + row) * 0.08}
          />
        ))
      )}
      <rect x="46" y="18" width="26" height="20" rx="3" fill={ill3} />
      <rect x="80" y="46" width="26" height="20" rx="3" fill={ill3} />
    </svg>
  );
}

export function IlluSummary({ colors }) {
  const { illBg, ill1, ill2, ill3, ill4 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      <circle cx="110" cy="72" r="46" stroke={ill1} strokeWidth="20" fill="none" />
      <circle cx="110" cy="72" r="46" stroke={ill3} strokeWidth="20" fill="none"
        strokeDasharray="145 144" strokeDashoffset="36" transform="rotate(-90 110 72)" />
      <circle cx="110" cy="72" r="46" stroke={ill2} strokeWidth="20" fill="none"
        strokeDasharray="72 217" strokeDashoffset="-109" transform="rotate(-90 110 72)" />
      <circle cx="110" cy="72" r="28" fill={illBg} />
      <text x="110" y="78" textAnchor="middle" fontSize="13" fill={ill4} fontWeight="700">CGT</text>
    </svg>
  );
}

export function IlluMethod({ colors }) {
  const { illBg, ill1, ill2, ill3, ill4 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      <rect x="24" y="30" width="130" height="22" rx="4" fill={ill3} />
      <rect x="24" y="60" width="80"  height="22" rx="4" fill={ill2} />
      <rect x="24" y="90" width="40"  height="22" rx="4" fill={ill1} />
      <text x="164" y="46"  fontSize="12" fill={ill4} fontWeight="600">Discount</text>
      <text x="114" y="76"  fontSize="12" fill={ill4} fontWeight="600">Indexed</text>
      <text x="74"  y="106" fontSize="12" fill={ill4} fontWeight="600">Other</text>
    </svg>
  );
}

export function IlluErrors({ colors }) {
  const { illBg, ill2, ill3, ill4 } = colors;
  return (
    <svg viewBox="0 0 220 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <rect width="220" height="140" fill={illBg} />
      <circle cx="110" cy="66" r="38" stroke={ill2} strokeWidth="3" fill="none" />
      <circle cx="110" cy="66" r="28" stroke={ill3} strokeWidth="2" strokeDasharray="6 4" fill="none" />
      <text x="110" y="60" textAnchor="middle" fontSize="24" fill={ill3} fontWeight="800">!</text>
      <text x="110" y="80" textAnchor="middle" fontSize="11" fill={ill4}>Check</text>
    </svg>
  );
}