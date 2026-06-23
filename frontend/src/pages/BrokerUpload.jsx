import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Breadcrumbs,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link as MuiLink,
  Chip,
} from "@mui/material";
import { DeleteOutline, Refresh, UploadFile } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import BrokerCSVUploader from "../components/BrokerCSVUploader";
import TransactionTable from "../components/TransactionTable";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { apiDelete } from "../services/apiClient";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 24,
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
  border: "1px solid #dbe1ea",
  marginBottom: theme.spacing(3),
}));

const brokerNameMap = {
  commsec: "CommSec",
  nabtrade: "NABTrade",
  selfwealth: "Selfwealth",
  webull: "Webull",
};

const brokerThemeMap = {
  commsec: "#f8c400",
  nabtrade: "#d71920",
  selfwealth: "#00a86b",
  webull: "#1677ff",
};

const formatCurrency = (value, currency = "AUD") => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const formatDate = (value) => {
  if (!value) return "No import yet";

  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const BrokerUpload = () => {
  const { brokerId: routeBrokerId } = useParams();
  const { user } = useAuth();

  const brokerDisplayName =
    brokerNameMap[routeBrokerId] ||
    routeBrokerId?.charAt(0).toUpperCase() + routeBrokerId?.slice(1);

  const brokerAccent = brokerThemeMap[routeBrokerId] || "#4f7cff";

  const [actualBrokerId, setActualBrokerId] = useState(null);
  const [transactionsForTable, setTransactionsForTable] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const [allBrokerActivities, setAllBrokerActivities] = useState([]);
  const [brokerPortfolioChartData, setBrokerPortfolioChartData] = useState([]);
  const [brokerHoldingsSummary, setBrokerHoldingsSummary] = useState([]);
  const [currentBrokerPortfolioValue, setCurrentBrokerPortfolioValue] =
    useState(0);
  const [isLoadingBrokerChartData, setIsLoadingBrokerChartData] =
    useState(false);

  const [timeRange, setTimeRange] = useState("all");
  const [graphType, setGraphType] = useState("stacked");
  const [selectedMarketsForBrokerChart, setSelectedMarketsForBrokerChart] =
    useState(["ALL"]);

  const [rawCsvRows, setRawCsvRows] = useState([]);
  const [rawCsvHeaders, setRawCsvHeaders] = useState([]);

  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const availableMarketsForBrokerChart = useMemo(() => {
    const markets = new Set(
      allBrokerActivities.map((tx) => tx.securities?.exchange).filter(Boolean),
    );

    return ["ALL", ...Array.from(markets)];
  }, [allBrokerActivities]);

  const totalDividends = useMemo(
    () =>
      allBrokerActivities
        .filter((tx) => String(tx.type || "").toLowerCase() === "dividend")
        .reduce((sum, tx) => sum + Number(tx.total_amount || 0), 0),
    [allBrokerActivities],
  );

  const totalFees = useMemo(
    () =>
      allBrokerActivities.reduce((sum, tx) => sum + Number(tx.fees || 0), 0),
    [allBrokerActivities],
  );

  const latestImport = useMemo(() => {
    const dates = allBrokerActivities
      .map((tx) => tx.created_at || tx.date)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a));

    return dates[0] || null;
  }, [allBrokerActivities]);

  const processAndSetBrokerPortfolioData = useCallback(
    (activitiesData) => {
      if (!activitiesData || activitiesData.length === 0) {
        setBrokerPortfolioChartData([]);
        setBrokerHoldingsSummary([]);
        setCurrentBrokerPortfolioValue(0);
        return;
      }

      const holdings = {};
      const chartPoints = [];

      const sortedActivities = [...activitiesData].sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      );

      sortedActivities.forEach((tx) => {
        const type = String(tx.type || "").toLowerCase();
        const symbol = tx.securities?.symbol || `unknown-${tx.security_id}`;
        const name = tx.securities?.name || symbol;
        const market = tx.securities?.exchange || "OTHER";
        const currency = tx.currency || tx.securities?.currency || "AUD";

        const quantity = Number(tx.quantity || 0);
        const price = Number(tx.price || 0);
        const fees = Number(tx.fees || 0);
        const totalAmount = Number(tx.total_amount || quantity * price || 0);

        const dateStr = new Date(tx.date).toISOString().split("T")[0];

        if (!holdings[symbol]) {
          holdings[symbol] = {
            symbol,
            name,
            market,
            quantity: 0,
            totalCost: 0,
            lastPrice: price,
            currency,
            dividendsReceived: 0,
            realizedGainLoss: 0,
          };
        }

        const holding = holdings[symbol];

        if (price > 0) {
          holding.lastPrice = price;
        }

        if (type === "buy") {
          holding.quantity += quantity;
          holding.totalCost += quantity * price + fees;
        }

        if (type === "sell") {
          if (holding.quantity > 0) {
            const avgCostPerShare = holding.totalCost / holding.quantity;
            const sellQty = Math.min(quantity, holding.quantity);
            const costOfSoldShares = avgCostPerShare * sellQty;
            const proceeds = quantity * price - fees;

            holding.realizedGainLoss += proceeds - costOfSoldShares;
            holding.quantity -= sellQty;
            holding.totalCost -= costOfSoldShares;

            if (holding.quantity < 0.00001) holding.quantity = 0;
            if (holding.quantity === 0) holding.totalCost = 0;
          }
        }

        if (type === "dividend") {
          holding.dividendsReceived += totalAmount;
        }

        let currentDayPortfolioValue = 0;
        const currentDayMarketValues = {};

        Object.values(holdings).forEach((h) => {
          const marketValue = h.quantity * h.lastPrice;
          currentDayPortfolioValue += marketValue;
          currentDayMarketValues[h.market] =
            (currentDayMarketValues[h.market] || 0) + marketValue;
        });

        const point = {
          date: dateStr,
          totalValue: currentDayPortfolioValue,
        };

        Object.entries(currentDayMarketValues).forEach(([marketKey, value]) => {
          point[marketKey] = value;
        });

        const existingPointIndex = chartPoints.findIndex(
          (p) => p.date === dateStr,
        );

        if (existingPointIndex > -1) {
          chartPoints[existingPointIndex] = point;
        } else {
          chartPoints.push(point);
        }
      });

      let filteredChartPoints = chartPoints;

      if (
        selectedMarketsForBrokerChart.length > 0 &&
        !selectedMarketsForBrokerChart.includes("ALL")
      ) {
        filteredChartPoints = chartPoints
          .map((point) => {
            const newPoint = { date: point.date, totalValue: 0 };
            let newTotalValue = 0;

            selectedMarketsForBrokerChart.forEach((market) => {
              if (point[market]) {
                newPoint[market] = point[market];
                newTotalValue += point[market];
              }
            });

            newPoint.totalValue = newTotalValue;
            return newPoint;
          })
          .filter((point) => point.totalValue > 0);
      }

      setBrokerPortfolioChartData(filteredChartPoints);

      const summary = Object.values(holdings)
        .filter((h) => h.quantity > 0.00001)
        .map((h) => {
          const currentValue = h.quantity * h.lastPrice;
          const unrealizedGainLoss = currentValue - h.totalCost;
          const totalReturn =
            unrealizedGainLoss + h.realizedGainLoss + h.dividendsReceived;

          return {
            symbol: h.symbol,
            name: h.name,
            price: h.lastPrice,
            quantity: h.quantity,
            value: currentValue,
            capitalGains: unrealizedGainLoss,
            dividends: h.dividendsReceived,
            currency: h.currency,
            return: totalReturn,
          };
        });

      setBrokerHoldingsSummary(summary);
      setCurrentBrokerPortfolioValue(
        summary.reduce((acc, holding) => acc + holding.value, 0),
      );
    },
    [selectedMarketsForBrokerChart],
  );

  const loadBrokerData = useCallback(async () => {
    if (!user || !brokerDisplayName) return;

    setIsLoadingTransactions(true);
    setIsLoadingBrokerChartData(true);

    try {
      const { data: brokerRows, error: brokerError } = await supabase
        .from("brokers")
        .select("id")
        .eq("user_id", user.id)
        .ilike("name", `%${brokerDisplayName}%`)
        .limit(1);

      if (brokerError) throw brokerError;

      const brokerDetails = brokerRows?.[0];

      if (!brokerDetails?.id) {
        setActualBrokerId(null);
        setAllBrokerActivities([]);
        setTransactionsForTable([]);
        processAndSetBrokerPortfolioData([]);
        setIsLoadingTransactions(false);
        setIsLoadingBrokerChartData(false);
        return;
      }

      setActualBrokerId(brokerDetails.id);

      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select(
          `
          id,
          type,
          date,
          quantity,
          price,
          total_amount,
          fees,
          currency,
          notes,
          broker_id,
          security_id,
          franking_percent,
          franking_credits,
          reduced_cost_base,
          created_at,
          securities:security_id (
            symbol,
            name,
            exchange,
            currency
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("broker_id", brokerDetails.id)
        .order("date", { ascending: true });

      if (activitiesError) throw activitiesError;

      const rawActivities = activitiesData || [];

      setAllBrokerActivities(rawActivities);

      const formattedForTable = rawActivities
        .map((tx) => ({
          id: tx.id,
          type: tx.type,
          date: tx.date,
          market: tx.securities?.exchange || "N/A",
          code: tx.securities?.symbol || "N/A",
          securityName: tx.securities?.name || tx.securities?.symbol || "N/A",
          quantity: tx.quantity,
          price: tx.price,
          brokerage: tx.fees,
          currency: tx.currency || tx.securities?.currency || "AUD",
          totalAmount: tx.total_amount,
          broker: brokerDisplayName,
          notes: tx.notes,
          frankingPercent: tx.franking_percent,
          frankingCredits: tx.franking_credits,
          reducedCostBase: tx.reduced_cost_base,
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      setTransactionsForTable(formattedForTable);
      processAndSetBrokerPortfolioData(rawActivities);
    } catch (error) {
      console.error("Error loading broker data:", error);

      setNotification({
        open: true,
        message: `Error loading data for ${brokerDisplayName}: ${error.message}`,
        severity: "error",
      });
    } finally {
      setIsLoadingTransactions(false);
      setIsLoadingBrokerChartData(false);
    }
  }, [user, brokerDisplayName, processAndSetBrokerPortfolioData]);

  useEffect(() => {
    loadBrokerData();
  }, [loadBrokerData]);

  const handleUploadComplete = async (data) => {
    const importedCount = data?.importedCount || 0;

    setRawCsvRows((prev) => [...prev, ...(data?.rawRows || [])]);

    setRawCsvHeaders((prev) =>
      Array.from(new Set([...prev, ...(data?.rawHeaders || [])])),
    );

    setNotification({
      open: true,
      message: `Successfully imported ${importedCount} transactions for ${brokerDisplayName}`,
      severity: "success",
    });

    await loadBrokerData();
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await apiDelete(`/api/activities/${transactionId}`);

      setNotification({
        open: true,
        message: "Transaction deleted",
        severity: "success",
      });

      await loadBrokerData();
    } catch (error) {
      console.error("Error deleting transaction:", error);

      setNotification({
        open: true,
        message: `Error: ${error.message}`,
        severity: "error",
      });
    }
  };

  const handleDeleteAllBrokerData = async () => {
    if (!actualBrokerId) {
      setNotification({
        open: true,
        message: `Broker ID not found for ${brokerDisplayName}. Cannot delete.`,
        severity: "error",
      });
      return;
    }

    setIsDeleting(true);

    try {
      await apiDelete(`/api/broker/${actualBrokerId}/activities`);

      setNotification({
        open: true,
        message: `All transactions from ${brokerDisplayName} deleted`,
        severity: "success",
      });

      await loadBrokerData();
    } catch (error) {
      console.error("Error deleting broker data:", error);

      setNotification({
        open: true,
        message: `Error: ${error.message}`,
        severity: "error",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleCloseNotification = () =>
    setNotification({ ...notification, open: false });

  const chartDistinctMarketsForBroker = useMemo(() => {
    if (brokerPortfolioChartData.length === 0) return [];

    const markets = new Set();

    brokerPortfolioChartData.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== "date" && key !== "totalValue") {
          markets.add(key);
        }
      });
    });

    return Array.from(markets).sort();
  }, [brokerPortfolioChartData]);

  const marketColors = {
    ASX: brokerAccent,
    NASDAQ: "#00C49F",
    NYSE: "#0088FE",
    LSE: "#FF8042",
    TSE: "#8884d8",
    OTHER: "#cccccc",
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      <Breadcrumbs separator="›" className="tool-breadcrumbs">
        <Link to="/brokers" className="tool-breadcrumb-link">
          🏠 <span>Upload via broker</span>
        </Link>

        <Typography className="tool-breadcrumb-current">
          {brokerDisplayName}
        </Typography>
      </Breadcrumbs>

      <Box
        sx={{
          mt: 2,
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Chip
              label="Broker workspace"
              size="small"
              sx={{
                mb: 1,
                fontWeight: 800,
                color: brokerAccent,
                backgroundColor: `${brokerAccent}18`,
              }}
            />

            <Typography variant="h3" component="h1" fontWeight={850} >
              {brokerDisplayName}
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
              Import CSV files, review transactions, and track portfolio value
              for this broker.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<UploadFile />}
            href="#broker-upload-section"
            sx={{
              height: 44,
              borderRadius: 3,
              backgroundColor: brokerAccent,
              color: "#fff",
              fontWeight: 800,
              boxShadow: "none",
              "&:hover": {
                backgroundColor: brokerAccent,
                boxShadow: `0 12px 28px ${brokerAccent}33`,
              },
            }}
          >
            Upload CSV
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography color="text.secondary" fontSize={13} fontWeight={700}>
              Current value
            </Typography>
            <Typography variant="h5" fontWeight={850}>
              {isLoadingBrokerChartData ? (
                <CircularProgress size={24} />
              ) : (
                formatCurrency(currentBrokerPortfolioValue)
              )}
            </Typography>
          </StyledPaper>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography color="text.secondary" fontSize={13} fontWeight={700}>
              Transactions
            </Typography>
            <Typography variant="h5" fontWeight={850}>
              {transactionsForTable.length.toLocaleString()}
            </Typography>
          </StyledPaper>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography color="text.secondary" fontSize={13} fontWeight={700}>
              Dividends
            </Typography>
            <Typography variant="h5" fontWeight={850}>
              {formatCurrency(totalDividends)}
            </Typography>
          </StyledPaper>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledPaper>
            <Typography color="text.secondary" fontSize={13} fontWeight={700}>
              Latest import
            </Typography>
            <Typography variant="h6" fontWeight={850}>
              {formatDate(latestImport)}
            </Typography>
          </StyledPaper>
        </Grid>
      </Grid>

      <StyledPaper sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h5" component="h2" fontWeight={850}>
              Portfolio Overview
            </Typography>

            <Typography color="text.secondary" fontSize={14}>
              Value movement grouped by market.
            </Typography>
          </Box>

          <Typography color="text.secondary" fontSize={14}>
            Total fees: <strong>{formatCurrency(totalFees)}</strong>
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
                disabled
              >
                <MenuItem value="all">All time</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Graph Type</InputLabel>
              <Select
                value={graphType}
                label="Graph Type"
                onChange={(e) => setGraphType(e.target.value)}
              >
                <MenuItem value="stacked">Value - Stacked by Market</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter Markets</InputLabel>
              <Select
                multiple
                value={selectedMarketsForBrokerChart}
                label="Filter Markets"
                renderValue={(selected) => selected.join(", ")}
                onChange={(e) => {
                  const value = e.target.value;

                  if (value.includes("ALL") && value.length > 1) {
                    setSelectedMarketsForBrokerChart(["ALL"]);
                  } else if (value.length === 0) {
                    setSelectedMarketsForBrokerChart(["ALL"]);
                  } else {
                    setSelectedMarketsForBrokerChart(
                      typeof value === "string" ? value.split(",") : value,
                    );
                  }
                }}
              >
                {availableMarketsForBrokerChart.map((market) => (
                  <MenuItem key={market} value={market}>
                    {market}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {isLoadingBrokerChartData ? (
          <Box
            sx={{
              height: 350,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : brokerPortfolioChartData.length > 0 ? (
          <Box sx={{ height: 350, width: "100%" }}>
            <ResponsiveContainer>
              <AreaChart
                data={brokerPortfolioChartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(tick) =>
                    new Date(`${tick}T00:00:00`).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })
                  }
                />
                <YAxis
                  tickFormatter={(value) =>
                    value >= 1000
                      ? `${(value / 1000).toFixed(0)}k`
                      : value.toFixed(0)
                  }
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCurrency(value, "AUD"),
                    name,
                  ]}
                />
                <Legend />

                {chartDistinctMarketsForBroker.map((marketKey) => (
                  <Area
                    key={marketKey}
                    type="monotone"
                    dataKey={marketKey}
                    stackId="1"
                    stroke={marketColors[marketKey] || "#808080"}
                    fill={marketColors[marketKey] || "#808080"}
                    fillOpacity={0.7}
                    name={marketKey}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Typography
            sx={{
              textAlign: "center",
              height: 240,
              py: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            No transaction data with {brokerDisplayName} to display chart.
          </Typography>
        )}
      </StyledPaper>

      <StyledPaper>
        <Typography variant="h6" sx={{ mb: 2 }} fontWeight={850}>
          Current Holdings
        </Typography>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: "bold" } }}>
                <TableCell>Security</TableCell>
                <TableCell align="right">Last Price</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Value</TableCell>
                <TableCell align="right">Unrealized P/L</TableCell>
                <TableCell align="right">Dividends</TableCell>
                <TableCell align="right">Total Return</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {brokerHoldingsSummary.map((holding) => (
                <TableRow key={holding.symbol} hover>
                  <TableCell>
                    <MuiLink component="span" sx={{ fontWeight: "medium" }}>
                      {holding.symbol}
                    </MuiLink>

                    <Typography
                      variant="caption"
                      display="block"
                      color="text.secondary"
                    >
                      {holding.name}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    {formatCurrency(holding.price, holding.currency)}
                  </TableCell>

                  <TableCell align="right">
                    {holding.quantity % 1 === 0
                      ? holding.quantity
                      : holding.quantity.toFixed(4)}
                  </TableCell>

                  <TableCell align="right">
                    {formatCurrency(holding.value, holding.currency)}
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      color:
                        holding.capitalGains >= 0
                          ? "success.main"
                          : "error.main",
                    }}
                  >
                    {formatCurrency(holding.capitalGains, holding.currency)}
                  </TableCell>

                  <TableCell align="right">
                    {formatCurrency(holding.dividends, holding.currency)}
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      color:
                        holding.return >= 0 ? "success.main" : "error.main",
                    }}
                  >
                    {formatCurrency(holding.return, holding.currency)}
                  </TableCell>
                </TableRow>
              ))}

              {brokerHoldingsSummary.length === 0 &&
                !isLoadingBrokerChartData && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No current holdings with {brokerDisplayName}.
                    </TableCell>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </TableContainer>
      </StyledPaper>

      <Divider sx={{ my: 4 }} />

      <Box id="broker-upload-section">
        <Typography variant="h5" component="h2" gutterBottom fontWeight={850}>
          Import & Manage Transactions
        </Typography>

        <StyledPaper sx={{ mb: 4 }}>
          <BrokerCSVUploader
            onUploadComplete={handleUploadComplete}
            brokerName={brokerDisplayName}
            brokerId={routeBrokerId}
          />
        </StyledPaper>
      </Box>

      {rawCsvRows.length > 0 && (
        <StyledPaper>
          <Typography variant="h6" sx={{ mb: 2 }} fontWeight={850}>
            Uploaded CSV Preview
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {rawCsvHeaders.map((header) => (
                    <TableCell key={header}>
                      <strong>{header}</strong>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {rawCsvRows.map((row, index) => (
                  <TableRow key={index}>
                    {rawCsvHeaders.map((header) => (
                      <TableCell key={header}>{row[header] || "-"}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </StyledPaper>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="h6" component="h3" fontWeight={850}>
          Transaction History
        </Typography>

        <Box>
          <Button
            variant="text"
            startIcon={<Refresh />}
            onClick={loadBrokerData}
            sx={{ mr: 1 }}
            disabled={isLoadingTransactions || isLoadingBrokerChartData}
          >
            Refresh Data
          </Button>

          {transactionsForTable.length > 0 && (
            <Button
              variant="text"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              Delete All {brokerDisplayName} Data
            </Button>
          )}
        </Box>
      </Box>

      <StyledPaper>
        {isLoadingTransactions ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : transactionsForTable.length > 0 ? (
          <TransactionTable
            transactions={transactionsForTable}
            onDelete={handleDeleteTransaction}
          />
        ) : (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No transactions found for {brokerDisplayName}.
            </Typography>
          </Box>
        )}
      </StyledPaper>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete All {brokerDisplayName} Data</DialogTitle>

        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete all transactions from{" "}
            {brokerDisplayName}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            onClick={handleDeleteAllBrokerData}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <CircularProgress size={24} sx={{ color: "white" }} />
            ) : (
              "Delete All"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default BrokerUpload;
