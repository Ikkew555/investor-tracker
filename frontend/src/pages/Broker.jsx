import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Breadcrumbs, Typography, CircularProgress } from "@mui/material";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

import "../components/Broker.css";

import commsecLogo from "../assets/brokers/commsec.png";
import nabtradeLogo from "../assets/brokers/nab.png";
import selfwealthLogo from "../assets/brokers/selfwealth.png";
import webullLogo from "../assets/brokers/webull.png";

const brokerProviders = [
  {
    id: "commsec",
    name: "CommSec",
    short: "COMMSEC",
    logo: commsecLogo,
    type: "Broker CSV",
    support: "Trades / Sales",
    tags: ["ASX", "Trades", "CSV"],
    color: "#f8c400",
  },
  {
    id: "nabtrade",
    name: "NABTrade",
    short: "NAB",
    logo: nabtradeLogo,
    type: "Broker CSV",
    support: "Cash / Dividends",
    tags: ["ASX", "Dividends", "CSV"],
    color: "#d71920",
  },
  {
    id: "selfwealth",
    name: "Selfwealth",
    short: "SW",
    logo: selfwealthLogo,
    type: "Broker CSV",
    support: "Trades",
    tags: ["ASX", "Trades", "CSV"],
    color: "#00a86b",
  },
  {
    id: "webull",
    name: "Webull",
    short: "WEBULL",
    logo: webullLogo,
    type: "Broker CSV",
    support: "Order records / Dividends",
    tags: ["ASX", "US", "Dividends", "CSV"],
    color: "#1677ff",
  },
];

const normaliseBrokerKey = (value = "") => {
  const text = String(value).toLowerCase().replace(/\s+/g, "");

  if (text.includes("commsec")) return "commsec";
  if (text.includes("nabtrade") || text.includes("nab")) return "nabtrade";
  if (text.includes("selfwealth")) return "selfwealth";
  if (text.includes("webull")) return "webull";

  return text;
};

const formatDate = (value) => {
  if (!value) return "Not imported yet";

  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function Broker() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("az");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);

  const [brokerRows, setBrokerRows] = useState([]);
  const [activityRows, setActivityRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadBrokerData = async () => {
      if (!user?.id) return;

      setIsLoading(true);

      try {
        const { data: brokersData, error: brokerError } = await supabase
          .from("brokers")
          .select("id, name, description, logo_url, created_at, updated_at")
          .eq("user_id", user.id);

        if (brokerError) throw brokerError;

        const brokerIds = (brokersData || []).map((broker) => broker.id);

        let activitiesData = [];

        if (brokerIds.length > 0) {
          const { data, error } = await supabase
            .from("activities")
            .select("id, broker_id, created_at, date")
            .eq("user_id", user.id)
            .in("broker_id", brokerIds);

          if (error) throw error;

          activitiesData = data || [];
        }

        setBrokerRows(brokersData || []);
        setActivityRows(activitiesData);
      } catch (error) {
        console.error("Error loading brokers:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadBrokerData();
  }, [user]);

  const brokerStats = useMemo(() => {
    const stats = {};

    brokerRows.forEach((broker) => {
      const key = normaliseBrokerKey(broker.name);

      if (!stats[key]) {
        stats[key] = {
          brokerId: broker.id,
          connected: true,
          dbName: broker.name,
          transactionCount: 0,
          lastImport: null,
        };
      }
    });

    activityRows.forEach((activity) => {
      const broker = brokerRows.find((item) => item.id === activity.broker_id);
      if (!broker) return;

      const key = normaliseBrokerKey(broker.name);

      if (!stats[key]) return;

      stats[key].transactionCount += 1;

      const currentDate = activity.created_at || activity.date;

      if (
        currentDate &&
        (!stats[key].lastImport ||
          new Date(currentDate) > new Date(stats[key].lastImport))
      ) {
        stats[key].lastImport = currentDate;
      }
    });

    return stats;
  }, [brokerRows, activityRows]);

  const connectedCount = useMemo(
    () =>
      brokerProviders.filter((broker) => brokerStats[broker.id]?.connected)
        .length,
    [brokerStats],
  );

  const totalTransactions = useMemo(
    () =>
      Object.values(brokerStats).reduce(
        (total, broker) => total + broker.transactionCount,
        0,
      ),
    [brokerStats],
  );

  const latestImport = useMemo(() => {
    const dates = Object.values(brokerStats)
      .map((broker) => broker.lastImport)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));

    return dates[0] || null;
  }, [brokerStats]);

  const brokers = useMemo(() => {
    return brokerProviders
      .map((broker) => ({
        ...broker,
        connected: Boolean(brokerStats[broker.id]?.connected),
        transactionCount: brokerStats[broker.id]?.transactionCount || 0,
        lastImport: brokerStats[broker.id]?.lastImport || null,
      }))
      .filter((broker) => {
        const matchesSearch = broker.name
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "connected" && broker.connected) ||
          (statusFilter === "not-connected" && !broker.connected);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "connected") {
          return Number(b.connected) - Number(a.connected);
        }

        return sortBy === "az"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      });
  }, [search, sortBy, statusFilter, brokerStats]);

  const openBroker = (id) => {
    navigate(`/brokers/${id}`);
  };

  return (
    <main className="broker-page">
      <div className="broker-content-wrapper">
        <Breadcrumbs separator="›" className="tool-breadcrumbs">
          <Link className="tool-breadcrumb-link">
            🏠 <span>Home</span>
          </Link>

          <Typography className="tool-breadcrumb-current">
            Upload via broker
          </Typography>
        </Breadcrumbs>

        <div className="broker-top-row">
          <div>
            <p className="broker-eyebrow">Broker providers</p>
            <h1>Upload via broker</h1>
            <p className="broker-helper">
              Choose a supported broker, import CSV files, and manage your
              portfolio transactions in one place.
            </p>
          </div>

          <button
            className="broker-primary-btn"
            onClick={() => setShowAddModal(true)}
          >
            <span>＋</span>
            Add investment
          </button>
        </div>

        <section className="broker-summary-grid">
          <div className="broker-summary-card">
            <span>Connected brokers</span>
            <strong>
              {isLoading ? <CircularProgress size={20} /> : connectedCount}
            </strong>
          </div>

          <div className="broker-summary-card">
            <span>Total transactions</span>
            <strong>
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                totalTransactions.toLocaleString()
              )}
            </strong>
          </div>

          <div className="broker-summary-card">
            <span>Latest import</span>
            <strong className="broker-summary-date">
              {isLoading ? <CircularProgress size={20} /> : formatDate(latestImport)}
            </strong>
          </div>
        </section>

        <section className="broker-panel">
          <div className="broker-filter-row">
            <div className="broker-search">
              <span>⌕</span>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for your broker by name..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All brokers</option>
              <option value="connected">Connected</option>
              <option value="not-connected">Not connected</option>
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="connected">Connected first</option>
              <option value="az">A - Z</option>
              <option value="za">Z - A</option>
            </select>
          </div>

          <div className="broker-list-toolbar">
            <p>
              Showing <strong>{brokers.length}</strong> of{" "}
              <strong>{brokerProviders.length}</strong> supported providers
            </p>
          </div>

          <div className="broker-grid">
            {brokers.map((broker) => (
              <button
                key={broker.id}
                className="broker-card broker-card-info"
                style={{ "--broker-accent": broker.color }}
                onClick={() => openBroker(broker.id)}
              >
                <div
                  className={`broker-status ${
                    broker.connected ? "connected" : "not-connected"
                  }`}
                >
                  {broker.connected ? "Connected" : "Not connected"}
                </div>

                <div className="broker-card-logo-area">
                  {broker.logo ? (
                    <img
                      src={broker.logo}
                      alt={`${broker.name} logo`}
                      className="broker-logo-img"
                    />
                  ) : (
                    <div className="broker-logo-text">{broker.short}</div>
                  )}
                </div>

                <div className="broker-card-body">
                  <h3>{broker.name}</h3>
                  <p>{broker.support}</p>

                  <div className="broker-tags">
                    {broker.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="broker-card-footer">
                  <span>
                    {broker.transactionCount > 0
                      ? `${broker.transactionCount.toLocaleString()} transactions`
                      : "No transactions yet"}
                  </span>

                  <span>{formatDate(broker.lastImport)}</span>
                </div>
              </button>
            ))}
          </div>

          {brokers.length === 0 && (
            <div className="broker-empty">
              No broker found. Try another keyword or filter.
            </div>
          )}
        </section>
      </div>

      {showAddModal && (
        <div
          className="add-modal-overlay"
          onClick={() => setShowAddModal(false)}
        >
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="add-modal-close"
              onClick={() => setShowAddModal(false)}
            >
              ×
            </button>

            <h2>Add your investments</h2>

            <p>
              Select one of the options below to add investments into your
              portfolio.
            </p>

            <h3>Trades</h3>

            <div className="add-option-grid">
              <button
                className="add-option-card active"
                onClick={() => setShowAddModal(false)}
              >
                <div className="add-option-icon">👥</div>
                <strong>Upload via broker</strong>
                <span>Choose supported broker ›</span>
              </button>

              <button
                className="add-option-card"
                onClick={() => navigate("/upload")}
              >
                <div className="add-option-icon">⬆</div>
                <strong>Upload via file</strong>
                <span>CSV import ›</span>
              </button>

              <button
                className="add-option-card"
                onClick={() => navigate("/add-trade")}
              >
                <div className="add-option-icon">＋</div>
                <strong>Individually add trade</strong>
                <span>Manual entry ›</span>
              </button>
            </div>

            <h3>Other investments</h3>

            <div className="add-option-grid small">
              <button className="add-option-card warning">
                <div className="add-option-icon">💵</div>
                <strong>Upgrade for cash accounts</strong>
                <span>Coming soon ›</span>
              </button>

              <button className="add-option-card">
                <div className="add-option-icon">◔</div>
                <strong>Create custom investment</strong>
                <span>Coming soon ›</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Broker;