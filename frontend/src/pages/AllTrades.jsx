import React, { useEffect, useState } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  // useTheme, // Removed useTheme from imports
} from "@mui/material";
import { ArrowBack } from "@mui/icons-material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const AllTrades = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const navigate = useNavigate();
  // const theme = useTheme(); // Removed this line

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        alert("You must be logged in.");
        // Consider navigating to login or showing a more user-friendly message
        setLoading(false); // Ensure loading is set to false
        return;
      }

      const { data, error } = await supabase
        .from("activities")
        .select(`
          id, type, date, quantity, price, fees, total_amount, user_id,
          securities (
            symbol
          )
        `)
        .in("type", ["Buy", "Sell"])
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Supabase fetch error:", error);
        setLoading(false);
        return;
      }

      const formatted = data.map((t) => {
        const qty = t.quantity;
        const value = t.total_amount || qty * t.price;
        return {
          symbol: t.securities?.symbol || "N/A",
          date: new Date(t.date).toLocaleDateString(), // Consider consistent date formatting
          type: t.type,
          qty,
          price: t.price,
          brokerage: t.fees || 0,
          exchRate: "1.00 AUD/AUD", // This seems hardcoded, ensure it's correct
          value,
        };
      });

      setTrades(formatted);
      setLoading(false);
    };

    fetchTrades();
  }, []);

  const filteredTrades =
    filterType === "All" ? trades : trades.filter((t) => t.type === filterType);

  const handleExport = () => {
    if (filteredTrades.length === 0) {
      // Optionally, provide feedback if there's no data to export
      // e.g., alert("No data to export.");
      return;
    }
    const exportData = filteredTrades.map(({ symbol, date, type, qty, price, brokerage, exchRate, value }) => ({
      Symbol: symbol,
      Date: date,
      Type: type,
      Quantity: qty,
      Price: price,
      Brokerage: brokerage,
      "Exchange Rate": exchRate, // More common to have spaces in Excel headers
      Value: value,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AllTrades");
    XLSX.writeFile(workbook, "All_Trades_Report.xlsx");
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate("/reports")}
          sx={{ mr: 2 }}
        >
          Back to Reports
        </Button>
        <Typography variant="h4" fontWeight="bold" sx={{ flexGrow: 1 }}>
          All Trades
        </Typography>
        <IconButton
          onClick={handleExport}
          // Consider using theme colors for better consistency if desired
          // sx={{ backgroundColor: theme.palette.info.light, color: theme.palette.info.contrastText, p: 1.5, mr: 1 }}
          sx={{ backgroundColor: "#90caf9", color: "white", p: 1.5, mr: 1 }}
          disabled={filteredTrades.length === 0} // Disable if no trades to export
        >
          <FileDownloadIcon />
        </IconButton>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <FormControl
            sx={(theme) => ({ // This 'theme' is a parameter and is fine
              minWidth: 220,
              mb: 3,
              "& .MuiInputBase-root": {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.background.paper,
              },
              "& .MuiSvgIcon-root": {
                color: theme.palette.text.primary,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.divider,
              },
              "& .MuiInputLabel-root": {
                color: theme.palette.text.secondary,
                // backgroundColor should cover the text only, not the whole label space
                // A common pattern is to set it on the label itself if needed for overlapping text.
                // For a floating label, this might not be needed or handled differently.
                // Test this to see if it's visually what you want.
                // backgroundColor: theme.palette.background.paper,
                // px: 0.5,
              },
            })}
            size="small"
          >
            <InputLabel
              id="type-filter-label"
              // If you want the label background to only be behind the text when shrunk
              sx={(theme) => ({
                '&.MuiInputLabel-shrink': {
                  backgroundColor: theme.palette.background.paper,
                  paddingRight: '4px', // Add some padding so text doesn't touch border
                  paddingLeft: '4px',
                }
              })}
            >
              Filter by Type
            </InputLabel>
            <Select
              labelId="type-filter-label"
              value={filterType}
              label="Filter by Type"
              onChange={(e) => setFilterType(e.target.value)}
            >
              <MenuItem value="All">All Transactions</MenuItem>
              <MenuItem value="Buy">Buy</MenuItem>
              <MenuItem value="Sell">Sell</MenuItem>
            </Select>
          </FormControl>

          <Paper elevation={3}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>ASX</TableCell> {/* Or "Symbol" / "Security" */}
                    <TableCell align="center">Date</TableCell>
                    <TableCell align="center">Type</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Brokerage</TableCell>
                    <TableCell align="center">Exch. Rate</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTrades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No trades found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTrades.map((t, i) => (
                      <TableRow key={t.id || i} hover> {/* Use a stable key like t.id if available */}
                        <TableCell>{t.symbol}</TableCell>
                        <TableCell align="center">{t.date}</TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            color:
                              t.type === "Sell"
                                ? "error.main"
                                : t.type === "Buy"
                                ? "success.main"
                                : "text.secondary", // Fallback for other types if any
                            fontWeight: 600,
                          }}
                        >
                          {t.type}
                        </TableCell>
                        <TableCell align="right">{t.qty}</TableCell>
                        <TableCell align="right">${t.price?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell align="right">${t.brokerage?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell align="center">{t.exchRate}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: t.value < 0 ? "error.main" : "text.primary",
                          }}
                        >
                          ${t.value?.toFixed(2) || '0.00'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default AllTrades;