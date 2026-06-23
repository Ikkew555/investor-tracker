// src/pages/ReportRoutes.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import AllTrades from "./AllTrades";
import TaxableIncome from "./TaxableIncome";
import SoldSecurities from "./SoldSecurities";
import HistoricCost from "./HistoricCost";
import PerformanceReport from "./PerformanceReport";
import Performance from "./Performance";



function ReportRoutes() {
  return (
    <Routes>
      <Route path="all-trades" element={<AllTrades />} />
      <Route path="taxable-income" element={<TaxableIncome />} />
      <Route path="sold-securities" element={<SoldSecurities />} />
      <Route path="historic-cost" element={<HistoricCost />} />
      <Route path="performance" element={<PerformanceReport />} />
      <Route path="brokers-performance" element={<Performance />} />


    </Routes>
  );
}

export default ReportRoutes;
