// ReportCard.jsx — clickable card shown on the Tax landing page.

import React, { useState } from "react";

export default function ReportCard({ report, onClick, C }) {
  const [hovered, setHovered] = useState(false);
  const { Illustration, title, subtitle } = report;

  return (
    <div
      className="tax-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:  C.cardBorder === "none" ? (hovered ? C.surfaceHover : "transparent") : (hovered ? C.surfaceHover : C.cardBg),
        border:      C.cardBorder === "none" ? "none" : `1px solid ${C.cardBorder}`,
        boxShadow:   hovered ? C.shadowH : C.shadow,
      }}
    >
      <div className="tax-card__illustration">
        <Illustration colors={C} />
      </div>

      <div className="tax-card__body">
        <div
          className="tax-card__title"
          style={{ color: hovered ? C.accentHover : C.accent }}
        >
          {title} <span style={{ fontSize: 16 }}>›</span>
        </div>
        <div className="tax-card__desc" style={{ color: C.muted }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}