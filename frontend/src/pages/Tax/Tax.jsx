// Tax.jsx — main entry point for the Tax page.
// Composes TaxLanding, TaxReport, and CGTPage, wires up theme and navigation state.

import React, { useState } from "react";
import { useTheme as useThemeContext } from "../../contexts/ThemeContext";
import { useTheme }   from "./UseTheme";
import { REPORTS }    from "./Reports";
import TaxLanding     from "./TaxLanding";
import TaxReport      from "./TaxReport";
import CGTPage        from "./CGTPage";
import "./Tax.css";

export default function TaxOutputPage() {
  const { mode } = useThemeContext();
  const CRaw = useTheme(mode);
  // Guard: ensure C always has all tokens before passing to children
  const C = CRaw ?? {
    pageBg: "transparent", bg: "#ffffff", surface: "transparent",
    border: "#e8e8e8", text: "#111111", muted: "#777777",
    accent: "#1a6fe8", thBg: "#f0f2f4", thText: "#444444",
    frankingBg: "#E1F5EE", frankingBorder: "#9FE1CB",
    frankingText: "#0F6E56", frankingMuted: "#1D9E75", frankingValue: "#0F6E56",
    fyBadgeBg: "#E6F1FB", fyBadgeText: "#0C447C",
    calcIconBg: "#E6F1FB", calcIconColor: "#185FA5",
    illBg: "#1e3340", ill1: "#2d5a6e", ill2: "#4a8fa8", ill3: "#7bbdd4", ill4: "#a8d8ea",
  };
  const [activeId, setActiveId] = useState(null);
  const [showCGT, setShowCGT]   = useState(false);
  const active = REPORTS.find((r) => r.id === activeId);

  return (
    <div className="tax-page" style={{ color: C.text }}>
      {showCGT ? (
        <CGTPage C={C} onBack={() => setShowCGT(false)} />
      ) : activeId && active ? (
        <TaxReport report={active} C={C} onBack={() => setActiveId(null)} />
      ) : (
        <TaxLanding C={C} onSelect={setActiveId} onCGT={() => setShowCGT(true)} />
      )}
    </div>
  );
}