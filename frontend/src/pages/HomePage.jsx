import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added useCallback
import {
  Box, Container, Typography, Paper, Grid, Button,
  Tabs, Tab, Alert, Snackbar, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle,
  Select, MenuItem, FormControl, InputLabel, FormGroup, FormControlLabel, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Link as MuiLink,
  Divider, Chip, Tooltip as MuiTooltip,
} from "@mui/material";
import { Add, UploadFile, Refresh, DeleteOutline, WarningAmber } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import EnhancedCSVUploader from "../components/EnhancedCSVUploader";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";
import TransactionTable from "../components/TransactionTable";
import AddTransactionForm from "../components/AddTransactionForm";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useAuth } from "../contexts/AuthContext";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 1.5,
  boxShadow: theme.shadows[2],
  transition: "box-shadow 0.3s ease-in-out",
  marginBottom: theme.spacing(3),
  "&:hover": {
    boxShadow: theme.shadows[4],
  },
}));

const formatCurrency = (value, currency = 'USD') => {
  if (typeof value !== 'number' || isNaN(value)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(0);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};


const HomePage = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [transactions, setTransactions] = useState([]); // For the table display
  const [allActivities, setAllActivities] = useState([]); // Raw activities for processing
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "success" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- State for Portfolio Chart ---
  const [portfolioChartData, setPortfolioChartData] = useState([]);
  const [portfolioHoldingsSummary, setPortfolioHoldingsSummary] = useState([]); // For the table below chart
  const [currentPortfolioValue, setCurrentPortfolioValue] = useState(0);
  const [isLoadingChartData, setIsLoadingChartData] = useState(false);

  // --- State for Performance API ---
  const [performanceData, setPerformanceData] = useState([]);
  const [perfTotalValue, setPerfTotalValue] = useState(null);
  const [perfStale, setPerfStale] = useState(false);
  const [isPerfLoading, setIsPerfLoading] = useState(false);

  // Chart controls state
  const [timeRange, setTimeRange] = useState('all');
  const [graphType, setGraphType] = useState('stacked');
  const [selectedMarketsForChart, setSelectedMarketsForChart] = useState(['ALL']);

  const availableMarketsForChart = useMemo(() => {
    const markets = new Set(allActivities.map(tx => tx.securities?.exchange).filter(Boolean));
    return ['ALL', ...Array.from(markets)];
  }, [allActivities]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    if (newValue === 0) setShowAddForm(false);
  };

  // --- SIMPLIFIED Portfolio Data Processing ---
  const processAndSetPortfolioData = useCallback((activitiesData) => {
    if (!activitiesData || activitiesData.length === 0) {
      setPortfolioChartData([]);
      setPortfolioHoldingsSummary([]);
      setCurrentPortfolioValue(0);
      return;
    }

    const holdings = {}; // Tracks current quantity and avg_cost for each security
    const chartPoints = [];
    // Map to store values for each market on a given date for stacking
    // dateString -> { ASX: value, NASDAQ: value, ... }
    // Ensure activities are sorted by date for chronological processing
    const sortedActivities = [...activitiesData].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedActivities.forEach(tx => {
      const securityId = tx.securities?.symbol || `unknown-${tx.security_id}`;
      const market = tx.securities?.exchange || 'OTHER';
      const dateObj = new Date(tx.date);
      const dateStr = dateObj.toISOString().split('T')[0];

      if (!holdings[securityId]) {
        holdings[securityId] = {
          symbol: tx.securities?.symbol,
          name: tx.securities?.name || securityId,
          market: market,
          quantity: 0,
          totalCost: 0, // Sum of (qty * price + fees) for buys
          lastPrice: tx.price, // Last known price from transactions
          currency: tx.currency,
          dividendsReceived: 0,
          realizedGainLoss: 0,
        };
      }
      const holding = holdings[securityId];
      holding.lastPrice = tx.price; // Update last known price

      if (tx.type.toLowerCase() === 'buy') {
        holding.quantity += tx.quantity;
        holding.totalCost += (tx.quantity * tx.price) + (tx.fees || 0);
      } else if (tx.type.toLowerCase() === 'sell') {
        if (holding.quantity > 0) { // Ensure we have shares to sell
            const avgCostPerShare = holding.totalCost / holding.quantity;
            const costOfSoldShares = avgCostPerShare * tx.quantity;
            const proceeds = (tx.quantity * tx.price) - (tx.fees || 0);
            holding.realizedGainLoss += proceeds - costOfSoldShares;
            holding.quantity -= tx.quantity;
            holding.totalCost -= costOfSoldShares;
            if (holding.quantity < 0.00001) holding.quantity = 0; // Avoid tiny negative numbers
            if (holding.quantity === 0) holding.totalCost = 0;
        }
      } else if (tx.type.toLowerCase() === 'dividend') {
        holding.dividendsReceived += tx.total_amount; // Assuming total_amount is the dividend
      }

      // --- For Chart Data ---
      // Calculate total portfolio value and per-market value *after* this transaction
      let currentDayPortfolioValue = 0;
      const currentDayMarketValues = {};

      Object.values(holdings).forEach(h => {
        // For chart simplicity, use last known transaction price as current market price
        const marketValue = h.quantity * h.lastPrice; 
        currentDayPortfolioValue += marketValue;
        currentDayMarketValues[h.market] = (currentDayMarketValues[h.market] || 0) + marketValue;
      });

      // Add/Update data point for the chart
      // We want one point per day that has transactions, showing EOD value.
      // If multiple transactions on the same day, this will overwrite with the latest state of that day.
      const point = { date: dateStr, totalValue: currentDayPortfolioValue };
      for (const mkt in currentDayMarketValues) {
        point[mkt] = currentDayMarketValues[mkt];
      }
      // Efficiently update or add the point for the date
      const existingPointIndex = chartPoints.findIndex(p => p.date === dateStr);
      if (existingPointIndex > -1) {
        chartPoints[existingPointIndex] = point;
      } else {
        chartPoints.push(point);
      }
    });
    
    // Filter chartPoints by selectedMarketsForChart (if not 'ALL')
    let filteredChartPoints = chartPoints;
    if (selectedMarketsForChart.length > 0 && !selectedMarketsForChart.includes('ALL')) {
        filteredChartPoints = chartPoints.map(point => {
            const newPoint = { date: point.date, totalValue: 0 };
            let newTotalValue = 0;
            selectedMarketsForChart.forEach(market => {
                if (point[market]) {
                    newPoint[market] = point[market];
                    newTotalValue += point[market];
                }
            });
            newPoint.totalValue = newTotalValue; // Recalculate totalValue based on selected markets
            return newPoint;
        });
    }


    setPortfolioChartData(filteredChartPoints);

    // --- For Holdings Summary Table ---
    const summary = Object.values(holdings)
      .filter(h => h.quantity > 0.00001) // Filter out effectively zero quantity holdings
      .map(h => {
        const currentValue = h.quantity * h.lastPrice; // Using last transaction price
        const unrealizedGainLoss = currentValue - h.totalCost;
        const totalReturn = unrealizedGainLoss + h.realizedGainLoss + h.dividendsReceived;
        return {
          symbol: h.symbol,
          name: h.name,
          price: h.lastPrice,
          quantity: h.quantity,
          value: currentValue,
          // "Capital Gains" in screenshot might be unrealized for open, or sum of realized for closed.
          // For this summary of *current* holdings, let's show unrealized.
          capitalGains: unrealizedGainLoss, // This is Unrealized P/L for current holdings
          dividends: h.dividendsReceived,
          currency: h.currency,
          return: totalReturn,
        };
      });
    setPortfolioHoldingsSummary(summary);
    setCurrentPortfolioValue(summary.reduce((acc, h) => acc + h.value, 0));

  }, [selectedMarketsForChart]); // Dependency: if market filter changes, re-process for chart


  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoadingTransactions(true);
    setIsLoadingChartData(true);
    try {
      const { data, error } = await supabase
        .from("activities")
        .select(`
          id, type, date, quantity, price, total_amount, fees, currency, notes,
          securities:security_id (symbol, name, exchange, currency),
          brokers:broker_id (name)
        `)
        .eq('user_id', user.id)
        .order("date", { ascending: true }); // Ascending for chronological processing

      if (error) throw error;
      
      const rawActivities = data || [];
      setAllActivities(rawActivities); // Store raw data

      // Format for transaction table (display purposes, sorted descending)
      const formattedForTable = rawActivities.map((tx) => ({
        id: tx.id, type: tx.type, date: new Date(tx.date).toLocaleDateString(),
        market: tx.securities?.exchange || "N/A", code: tx.securities?.symbol || "N/A",
        securityName: tx.securities?.name || tx.securities?.symbol || "N/A",
        quantity: tx.quantity, price: tx.price, brokerage: tx.fees,
        currency: tx.currency, totalAmount: tx.total_amount,
        broker: tx.brokers?.name || "N/A", notes: tx.notes,
      })).sort((a, b) => new Date(b.dateParsed || b.date) - new Date(a.dateParsed || a.date)); // Ensure date is parsed for sort
      setTransactions(formattedForTable);
      
      // Process for chart and summary using the raw activities
      processAndSetPortfolioData(rawActivities);

    } catch (error) {
      console.error("Error loading data:", error);
      setNotification({ open: true, message: `Error loading data: ${error.message}`, severity: "error" });
    } finally {
      setIsLoadingTransactions(false);
      setIsLoadingChartData(false);
    }
  }, [user, processAndSetPortfolioData]); // Added processAndSetPortfolioData

  useEffect(() => {
    loadData();
  }, [loadData]); // Load data on mount or when user changes

  // Fetch performance data from backend API
  const loadPerformance = useCallback(() => {
    if (!user) return;
    setIsPerfLoading(true);
    apiFetch(`/api/feature/performance/${user.id}`)
      .then((res) => {
        const rows = res.data || [];
        setPerformanceData(rows);
        setPerfTotalValue(rows.reduce((sum, r) => sum + (r.market_value ?? 0), 0));
        setPerfStale(res.stale_data || false);
      })
      .catch((err) => {
        console.error("Performance API error:", err);
      })
      .finally(() => setIsPerfLoading(false));
  }, [user]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);


  const handleUploadComplete = (importedDataCount) => {
    setNotification({ open: true, message: `Successfully imported ${importedDataCount} transactions`, severity: "success" });
    loadData();
    loadPerformance();
    setTabValue(0);
  };

  const handleAddTransaction = async (newTransactionData) => {
    // Your existing logic, ensure it calls loadData() on success
    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("User not found");

        const { data: securityData, error: securityError } = await supabase
            .from("securities")
            .select("id, name, currency")
            .eq("symbol", newTransactionData.code)
            .eq("exchange", newTransactionData.market)
            .single();

        let securityId;
        let securityName = newTransactionData.securityName || newTransactionData.code;
        let securityCurrency = newTransactionData.currency;

        if (securityError && securityError.code !== 'PGRST116') { // PGRST116 = no rows found
            throw securityError;
        }
        
        if (!securityData) { // Security does not exist, create it
            const { data: newSecurity, error: createSecurityError } = await supabase
                .from("securities")
                .insert({
                    symbol: newTransactionData.code,
                    name: securityName,
                    asset_class: newTransactionData.assetClass || "Equity",
                    currency: securityCurrency,
                    exchange: newTransactionData.market,
                })
                .select("id, name, currency")
                .single();
            if (createSecurityError) throw createSecurityError;
            securityId = newSecurity.id;
            securityName = newSecurity.name; 
            securityCurrency = newSecurity.currency;
        } else { // Security exists
            securityId = securityData.id;
            securityName = securityData.name; 
            securityCurrency = securityData.currency;
        }

        let totalAmount = 0;
        const q = parseFloat(newTransactionData.quantity);
        const p = parseFloat(newTransactionData.price);
        const b = parseFloat(newTransactionData.brokerage || 0);

        if (newTransactionData.type === 'Dividend') {
            totalAmount = p; // For dividend, price field is the total dividend amount
        } else if (newTransactionData.type === 'Buy') {
            totalAmount = (p * q) + b;
        } else if (newTransactionData.type === 'Sell') {
            totalAmount = (p * q) - b;
        }

        const { error: activityError } = await supabase.from("activities").insert({
            user_id: currentUser.id,
            security_id: securityId,
            broker_id: newTransactionData.brokerId || null,
            type: newTransactionData.type,
            date: newTransactionData.date,
            quantity: newTransactionData.type === 'Dividend' ? null : q,
            price: p, // Store unit price
            total_amount: totalAmount, // Store actual amount credited/debited
            fees: b,
            currency: securityCurrency,
            notes: newTransactionData.notes,
        });

        if (activityError) throw activityError;

        setNotification({ open: true, message: "Transaction added successfully", severity: "success" });
        loadData(); 
        setShowAddForm(false);
    } catch (err) {
        console.error("Error adding transaction:", err);
        setNotification({ open: true, message: `Error adding transaction: ${err.message}`, severity: "error" });
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    // Your existing logic, ensure it calls loadData() on success
     try {
        const { error } = await supabase.from("activities").delete().eq("id", transactionId);
        if (error) throw error;
        setNotification({ open: true, message: "Transaction deleted", severity: "success" });
        loadData(); 
    } catch (error) {
        console.error("Error deleting transaction:", error);
        setNotification({ open: true, message: `Error: ${error.message}`, severity: "error" });
    }
  };

  const handleCloseNotification = () => setNotification({ ...notification, open: false });
  const handleOpenDeleteDialog = () => setDeleteDialogOpen(true);
  const handleCloseDeleteDialog = () => setDeleteDialogOpen(false);

  const handleDeleteAllData = async () => {
    // Your existing logic, ensure it calls loadData() or clears state
    if (!user) return;
    setIsDeleting(true);
    try {
        const { error } = await supabase.from("activities").delete().eq("user_id", user.id);
        if (error) throw error;
        setNotification({ open: true, message: "All transaction data deleted", severity: "success" });
        loadData();
        loadPerformance();
    } catch (error) {
        console.error("Error deleting all data:", error);
        setNotification({ open: true, message: `Error: ${error.message}`, severity: "error" });
    } finally {
        setIsDeleting(false);
        setDeleteDialogOpen(false);
    }
  };

  const chartDistinctMarkets = useMemo(() => {
    if (portfolioChartData.length === 0) return [];
    const markets = new Set();
    portfolioChartData.forEach(d => {
      Object.keys(d).forEach(key => {
        if (key !== 'date' && key !== 'totalValue') { // Exclude special keys
          markets.add(key);
        }
      });
    });
    return Array.from(markets).sort(); // Sort for consistent legend/color order
  }, [portfolioChartData]);

  const marketColors = {
    ASX: '#ffbb28', // Orange/Yellow
    NASDAQ: '#00C49F', // Teal
    NYSE: '#0088FE', // Blue
    LSE: '#FF8042', // Coral
    TSE: '#8884d8', // Purple
    OTHER: '#cccccc', // Light Grey
    // Add more or make dynamic
  };
  const defaultColor = '#808080'; // Default grey for unassigned markets

  // JSX remains largely the same from the previous response for the chart and summary table section.
  // Ensure the <AreaChart> section dynamically renders <Area> components based on `chartDistinctMarkets`.
  // Update the <Select> for Markets to use `availableMarketsForChart` and `selectedMarketsForChart`.
  // The summary table uses `portfolioHoldingsSummary`.

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
      {/* --- Portfolio Value and Chart Section --- */}
      <StyledPaper>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2" fontWeight="medium">
            Your Portfolio
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Current portfolio value</Typography>
              {perfStale && (
                <MuiTooltip title="Data may be outdated. Airflow pipeline has not run recently.">
                  <WarningAmber fontSize="small" color="warning" />
                </MuiTooltip>
              )}
            </Box>
            <Typography variant="h5" component="p" fontWeight="bold">
              {isPerfLoading ? <CircularProgress size={24} /> : formatCurrency(perfTotalValue ?? currentPortfolioValue, 'AUD')}
            </Typography>
          </Box>
        </Box>
        <Grid container spacing={2} sx={{ mb: 2 }} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Time Range</InputLabel>
              <Select value={timeRange} label="Time Range" onChange={(e) => setTimeRange(e.target.value)} disabled>
                <MenuItem value="all">All time</MenuItem> {/* Add more later */}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Graph Type</InputLabel>
              <Select value={graphType} label="Graph Type" onChange={(e) => setGraphType(e.target.value)}>
                <MenuItem value="stacked">Value - Stacked by Market</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
             <FormControl fullWidth size="small">
              <InputLabel>Filter Markets</InputLabel>
              <Select
                multiple
                value={selectedMarketsForChart}
                onChange={(e) => {
                    const value = e.target.value;
                    // Handle 'ALL' selection
                    if (value.includes('ALL') && value.length > 1) {
                        // If 'ALL' is selected with others, only keep 'ALL'
                        setSelectedMarketsForChart(['ALL']);
                    } else if (value.length === 0) {
                        // If nothing is selected, default to 'ALL'
                         setSelectedMarketsForChart(['ALL']);
                    }
                    else {
                        setSelectedMarketsForChart(typeof value === 'string' ? value.split(',') : value);
                    }
                }}
                label="Filter Markets"
                renderValue={(selected) => selected.join(', ')}
              >
                {availableMarketsForChart.map((market) => (
                  <MenuItem key={market} value={market}>
                    {market}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {isLoadingChartData ? (
          <Box sx={{ height: 350, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box>
        ) : portfolioChartData.length > 0 ? (
          <Box sx={{ height: 350, width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={portfolioChartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(tick) => new Date(tick + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} />
                <YAxis tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0) } />
                <Tooltip formatter={(value, name) => [formatCurrency(value, 'AUD'), name]}/>
                <Legend />
                {chartDistinctMarkets.map((marketKey) => (
                  <Area
                    key={marketKey}
                    type="monotone"
                    dataKey={marketKey}
                    stackId="1"
                    stroke={marketColors[marketKey] || defaultColor}
                    fill={marketColors[marketKey] || defaultColor}
                    fillOpacity={0.7}
                    name={marketKey}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Typography sx={{ textAlign: 'center', height: 350, py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            No transaction data available to display chart.
          </Typography>
        )}
        
        <TableContainer sx={{ mt: 4 }}>
            {perfStale && (
              <Box sx={{ mb: 1 }}>
                <Chip
                  icon={<WarningAmber fontSize="small" />}
                  label="Showing estimated data — Airflow pipeline has not run recently"
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              </Box>
            )}
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 'bold' }}}>
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
                    {isPerfLoading && (
                        <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                                <CircularProgress size={28} />
                            </TableCell>
                        </TableRow>
                    )}
                    {!isPerfLoading && performanceData.map((row) => (
                        <TableRow key={row.symbol} hover>
                            <TableCell component="th" scope="row">
                                <MuiLink component="span" sx={{ fontWeight: 'medium' }}>{row.symbol}</MuiLink>
                                <Typography variant="caption" display="block" color="text.secondary">{row.name}</Typography>
                            </TableCell>
                            <TableCell align="right">{formatCurrency(row.market_price, 'AUD')}</TableCell>
                            <TableCell align="right">
                                {row.quantity % 1 === 0 ? row.quantity : Number(row.quantity).toFixed(4)}
                            </TableCell>
                            <TableCell align="right">{formatCurrency(row.market_value, 'AUD')}</TableCell>
                            <TableCell align="right" sx={{ color: row.unrealised_gain >= 0 ? 'success.main' : 'error.main' }}>
                                {formatCurrency(row.unrealised_gain, 'AUD')}
                            </TableCell>
                            <TableCell align="right">{formatCurrency(row.dividend_income, 'AUD')}</TableCell>
                            <TableCell align="right" sx={{ color: row.total_return >= 0 ? 'success.main' : 'error.main' }}>
                                {formatCurrency(row.total_return, 'AUD')}
                                {row.total_return_pct !== 0 && (
                                    <Typography variant="caption" display="block" color="text.secondary">
                                        {row.total_return_pct >= 0 ? '+' : ''}{Number(row.total_return_pct).toFixed(2)}%
                                    </Typography>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {!isPerfLoading && performanceData.length > 0 && (
                        <TableRow sx={{ '& td, & th': { borderTop: '2px solid rgba(224, 224, 224, 1)', fontWeight: 'bold' } }}>
                            <TableCell>Total</TableCell>
                            <TableCell align="right" />
                            <TableCell align="right" />
                            <TableCell align="right">{formatCurrency(performanceData.reduce((s, r) => s + (r.market_value ?? 0), 0), 'AUD')}</TableCell>
                            <TableCell align="right" sx={{ color: performanceData.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0) >= 0 ? 'success.main' : 'error.main' }}>
                                {formatCurrency(performanceData.reduce((s, r) => s + (r.unrealised_gain ?? 0), 0), 'AUD')}
                            </TableCell>
                            <TableCell align="right">
                                {formatCurrency(performanceData.reduce((s, r) => s + (r.dividend_income ?? 0), 0), 'AUD')}
                            </TableCell>
                            <TableCell align="right" sx={{ color: performanceData.reduce((s, r) => s + (r.total_return ?? 0), 0) >= 0 ? 'success.main' : 'error.main' }}>
                                {formatCurrency(performanceData.reduce((s, r) => s + (r.total_return ?? 0), 0), 'AUD')}
                            </TableCell>
                        </TableRow>
                    )}
                    {!isPerfLoading && performanceData.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                No performance data yet. Add transactions and wait for the pipeline to run.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
      </StyledPaper>

      <Divider sx={{ my: 4 }} />

      {/* --- Existing Transactions and Import Section --- */}
      {/* ... (this part remains the same as your original structure, no changes needed here) ... */}
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold" sx={{ mb: 4 }}>
        Manage Data
      </Typography>
      {/* ... (rest of your existing JSX for transactions and import tabs) ... */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: 'center' }}>
        <Typography variant="body1">Quick Actions:</Typography>
        <Button variant="outlined" startIcon={<UploadFile />} onClick={() => { setTabValue(1); setShowAddForm(false); }}>
          Import CSV
        </Button>
        <Button variant="outlined" startIcon={<Add />} onClick={() => { setTabValue(0); setShowAddForm(true); }}>
          Add Transaction
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="data management tabs">
          <Tab label="All Transactions" />
          <Tab label="Import from CSV" />
        </Tabs>
      </Box>

      {tabValue === 0 && ( /* Transactions Tab Content */
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Transaction History</Typography>
            <Box>
                <Button variant="text" startIcon={<Refresh />} onClick={loadData} sx={{ mr: 1 }} disabled={isLoadingTransactions}>
                    Refresh
                </Button>
                {transactions.length > 0 && (
                    <Button variant="text" color="error" startIcon={<DeleteOutline />} onClick={handleOpenDeleteDialog} disabled={isDeleting}>
                    Delete All
                    </Button>
                )}
            </Box>
          </Box>
          {showAddForm && (
            <StyledPaper sx={{ mb: 3, mt:1 }}>
              <AddTransactionForm onSubmit={handleAddTransaction} onCancel={() => setShowAddForm(false)} />
            </StyledPaper>
          )}
          <StyledPaper>
            {isLoadingTransactions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : transactions.length > 0 ? (
              <TransactionTable transactions={transactions} onDelete={handleDeleteTransaction} />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">No transactions yet.</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Import or add them manually.</Typography>
              </Box>
            )}
          </StyledPaper>
        </>
      )}
      {tabValue === 1 && ( /* Import Tab Content */
        <StyledPaper>
          <Typography variant="h6" gutterBottom>Import Transactions via CSV</Typography>
           <Typography variant="body1" paragraph>
            <strong>How to import your CSV:</strong>
          </Typography>
          <Box component="ol" sx={{ pl: 3, mb: 2 }}>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Download your transaction history in CSV format from your broker.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              In the dropdown below, select the broker format that matches your
              CSV.
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Click “Choose File” and select your CSV file.
            </Typography>
            <Typography component="li" variant="body2">
              Hit “Upload” and wait for the confirmation message.
            </Typography>
          </Box>

          <Typography variant="body1" paragraph>
            Supported formats:
          </Typography>
          <ul>
            <li>Sharesight</li>
            <li>180 Markets</li>
            <li>708 Wealth Management</li>
            <li>Alpine Capital</li>
            <li>ASR Wealth Advisers</li>
            <li>HSBC Australia</li>
          </ul>
          <EnhancedCSVUploader onUploadComplete={(data) => handleUploadComplete(data.importedCount || data.length)} /> {/* Ensure correct prop */}
        </StyledPaper>
      )}

      {/* Dialogs and Snackbar */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete All Transaction Data</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete ALL of your transaction data? This
            will remove all transactions across all brokers and cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color="primary" disabled={isDeleting}>Cancel</Button>
          <Button onClick={handleDeleteAllData} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} sx={{color: 'white'}}/> : "Delete Everything"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} variant="filled" sx={{ width: "100%" }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default HomePage;