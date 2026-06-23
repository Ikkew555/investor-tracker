import React, { useEffect, useState } from "react";
import { Box, CircularProgress, Breadcrumbs, Typography } from "@mui/material";
import { Link, useSearchParams } from "react-router-dom";

import ToolsCard from "../components/ToolsCard";
import PerformancePage from "./Performance";
import SoldSecuritiesPage from "./SoldSecurities";
import FutureIncomePage from "./FutureIncome";
import ContributionAnalysis from "./ContributionAnalysis";
import MultiCurrencyValuation from "./MultiCurrencyValuation";
import MultiPeriod from "./MultiPeriod";
import CalendarPage from "./Calendar";

import PerformanceSVG from "../assets/performance.svg";
import SoldSecuritiesSVG from "../assets/sold_secutities.svg";
import FutureIncomeSVG from "../assets/future_income.svg";
import ContributionAnalysisSVG from "../assets/contribution_analysis.svg";
import MultiCurrencyValuationSVG from "../assets/multi_currency.svg";
import CalendarSVG from "../assets/calendar.svg";
import MultiPeriodSVG from "../assets/multi_period.svg";

import "../components/tools-theme.css";
import "../components/ToolsCard.css";

const toolList = [
  {
    id: "performance",
    image: PerformanceSVG,
    name: "Performance",
    desc: "Provides information to help track and manage portfolios.",
    component: <PerformancePage />,
  },
  {
    id: "sold-securities",
    image: SoldSecuritiesSVG,
    name: "Sold Securities",
    desc: "View and manage sold assets in your portfolio.",
    component: <SoldSecuritiesPage />,
  },
  {
    id: "future-income",
    image: FutureIncomeSVG,
    name: "Future Income",
    desc: "Estimate future returns and passive income.",
    component: <FutureIncomePage />,
  },
  {
    id: "contribution-analysis",
    image: ContributionAnalysisSVG,
    name: "Contribution Analysis",
    desc: "Understand which holdings contribute the most.",
    component: <ContributionAnalysis />,
  },
  {
    id: "multi-currency",
    image: MultiCurrencyValuationSVG,
    name: "Multi-Currency Valuation",
    desc: "Track portfolio values in different currencies.",
    component: <MultiCurrencyValuation />,
  },
  {
    id: "multi-period",
    image: MultiPeriodSVG,
    name: "Multi-Period",
    desc: "Compare performance across different periods.",
    component: <MultiPeriod />,
  },
  {
    id: "calendar",
    image: CalendarSVG,
    name: "Calendar",
    desc: "See important portfolio-related dates in one place.",
    component: <CalendarPage />,
  },
];

const ToolsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const selectedToolId = searchParams.get("tool");

  const selectedTool =
    toolList.find((tool) => tool.id === selectedToolId) || null;

  const featuredTool = toolList.find((tool) => tool.id === "performance");

  useEffect(() => {
    // if (!selectedTool) {
    //   setLoading(false);
    //   return;
    // }

    // setLoading(true);

    // const timer = setTimeout(() => {
    //   setLoading(false);
    // }, 600);

    // return () => clearTimeout(timer);
  }, [selectedToolId, selectedTool]);

  const handleSelectTool = (tool) => {
    setSearchParams({ tool: tool.id });
  };

  const handleBackToTools = () => {
    setLoading(false);
    setSearchParams({});
  };

  return (
    <div className="tools-page-container">
      <div className="tools-page-header">
        <Breadcrumbs separator="›" className="tool-breadcrumbs">
          <span>🏠</span>

          <Link
            to="/tools"
            className="tool-breadcrumb-link"
            onClick={handleBackToTools}
          >
            Tools
          </Link>

          {selectedTool && (
            <Typography className="tool-breadcrumb-current">
              {selectedTool.name}
            </Typography>
          )}
        </Breadcrumbs>

        {!selectedTool && (
          <>
            <div>
              <h1
                className="tax-landing__title"
                style={{margin: 0 }}
              >
                Tools
              </h1>
              <p style={{ fontSize: 13, color: "grey", marginBottom: 20 }}>
                Manage your Australian tax obligations — CGT, dividends, and ATO
                reporting
              </p>
              <div className="tools-dashboard-hero">
                <div className="tools-hero-main">
                  <div className="tools-hero-icon">🧰</div>
                  <div>
                    <h2>Investment Tools</h2>
                    <p>
                      Explore portfolio performance, dividend income, currency
                      exposure, contribution analysis, and calendar events in
                      one place.
                    </p>
                  </div>
                </div>

                <button className="tools-hero-button" type="button">
                  {toolList.length} Tools Available →
                </button>
              </div>

              <div className="tools-insight-grid">
                <div className="tools-insight-card">
                  <p>Most Useful</p>
                  <h3>Performance</h3>
                  <span>Track portfolio growth</span>
                </div>

                <div className="tools-insight-card">
                  <p>Income View</p>
                  <h3>Future Income</h3>
                  <span>Forecast passive income</span>
                </div>

                <div className="tools-insight-card">
                  <p>Planning</p>
                  <h3>Calendar</h3>
                  <span>Upcoming portfolio dates</span>
                </div>
              </div>

              {featuredTool && (
                <div
                  className="tools-feature-card"
                  onClick={() => handleSelectTool(featuredTool)}
                >
                  <div>
                    <span className="tools-feature-label">
                      Recommended first
                    </span>
                    <h3>{featuredTool.name}</h3>
                    <p>{featuredTool.desc}</p>
                  </div>

                  <button type="button">Open tool →</button>
                </div>
              )}

              <div className="tools-section-header">
                <h3>All Tools</h3>
                <span>Select a tool to view its section</span>
              </div>
            </div>
          </>
        )}
      </div>

      <Box className="tools-page-box">
        {!selectedTool ? (
          <ToolsCard toolList={toolList} onSelectTool={handleSelectTool} />
        ) : (
          <div className="tool-content-shell">
            {loading ? (
              <div className="page-loader">
                <CircularProgress size={46} />
                <p>Loading...</p>
              </div>
            ) : (
              <div className="tool-content-box">{selectedTool.component}</div>
            )}
          </div>
        )}
      </Box>
    </div>
  );
};

export default ToolsPage;
