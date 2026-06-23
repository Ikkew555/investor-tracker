import React from "react";
import "../components/Dropdowns.css";

const Dropdowns = ({ onGraphTypeChange }) => (
  <div className="dropdowns-container">
    <select className="dropdown">
      <option>In the last 5 years</option>
      <option>In the last 10 years</option>
      <option>Since inception</option>
    </select>

    <select
      className="dropdown"
      onChange={(e) => onGraphTypeChange(e.target.value)}
    >
      <option value="line">Graph value - line</option>
      <option value="area">Graph value - area</option>
      <option value="bar">Graph value - bar</option>
    </select>

    <select className="dropdown">
      <option>US Market</option>
      <option>European Market</option>
      <option>Asian Market</option>
    </select>
  </div>
);

export default Dropdowns;
