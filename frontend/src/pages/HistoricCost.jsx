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
  Button,
  // useTheme, // Removed: useTheme is not directly needed here
  IconButton,
  Tooltip
} from "@mui/material";
import { ArrowBack, Download } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";

const HistoricCost = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  // const theme = useTheme(); // Removed this line

  useEffect(() => {
    const fetchHistoricCost = async () => {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("User not authenticated:", authError);
        alert("User not authenticated. Please log in."); // Optional: user-facing message
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("activities")
        .select(`*, securities:security_id (symbol)`)
        .eq("user_id", user.id)
        .eq("type", "Buy");

      if (error) {
        console.error("Supabase fetch error:", error);
        setLoading(false);
        return;
      }

      const grouped = {};

      data.forEach((row) => {
        const symbol = row.securities?.symbol || row.security_id || "UNKNOWN"; // Fallback for symbol
        const qty = Number(row.quantity) || 0; // Ensure numeric
        const price = Number(row.price) || 0;   // Ensure numeric
        const fees = Number(row.fees) || 0;     // Ensure numeric
        const cost = qty * price + fees;

        if (!grouped[symbol]) {
          grouped[symbol] = {
            symbol,
            allocation: "FIFO", // This seems hardcoded, review if dynamic
            openingBalance: 0,
            openingQty: 0,
            openingMarketValue: 0, // This is always 0 in the table, is it needed?
            purchases: 0,
          };
        }

        grouped[symbol].openingBalance += cost;
        grouped[symbol].openingQty += qty;
        grouped[symbol].purchases += cost; // Is this correct? Or should purchases be separate?
                                            // 'openingBalance' seems to accumulate all purchase costs.
                                            // 'purchases' also accumulates all purchase costs.
                                            // If 'openingBalance' is the total historic cost for existing holdings
                                            // and 'purchases' represents new purchases within a period, the logic might need adjustment.
                                            // For a pure historic cost report, 'openingBalance' might be all that's needed or 'totalCost'.
      });

      setRows(Object.values(grouped));
      setLoading(false);
    };

    fetchHistoricCost();
  }, []);

  const totalOpening = rows.reduce((sum, r) => sum + r.openingBalance, 0);
  const totalQty = rows.reduce((sum, r) => sum + r.openingQty, 0);
  const totalPurchases = rows.reduce((sum, r) => sum + r.purchases, 0);
  // If openingBalance and purchases are currently the same, one of these totals might be redundant for display.

  const handleExport = () => {
    if (rows.length === 0) return; // Don't export if no data
    
    // Define the data to be exported, ensure headers match table
    const exportData = rows.map(r => ({
      "ASX": r.symbol,
      "Allocation Method": r.allocation,
      "Opening Balance": r.openingBalance,
      "Opening Market Value": 0, // Matches table
      "Opening Quantity": r.openingQty,
      "Purchases": r.purchases,
    }));

    // Add totals to export data
    exportData.push({}); // Empty row for spacing
    exportData.push({
      "ASX": "Total",
      "Opening Balance": totalOpening,
      "Opening Quantity": totalQty,
      "Purchases": totalPurchases,
    });
    // Consider if Grand Total is also needed in Excel or if "Total" is sufficient.

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HistoricCost");
    XLSX.writeFile(workbook, "historic_cost_report.xlsx");
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}> {/* Increased mb for spacing */}
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => navigate("/reports")}
          sx={{ mr: 2 }}
        >
          Back to Reports
        </Button>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Historic Cost
        </Typography>
        <Tooltip title="Download as XLSX">
          <IconButton
            onClick={handleExport}
            sx={{ 
              ml: "auto", 
              // Consider using theme colors for consistency
              // backgroundColor: (theme) => theme.palette.info.light, 
              // color: (theme) => theme.palette.info.contrastText,
              backgroundColor: "#90caf9", // Current style
              color: "white", 
              // borderRadius: "50%", // IconButton is often round by default or based on theme
              // width: 40, 
              // height: 40,
              // Using p for padding is usually simpler with IconButton
              p: 1.25 
            }}
            disabled={rows.length === 0} // Disable if no data
          >
            <Download />
          </IconButton>
        </Tooltip>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={3}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ASX</TableCell>
                  <TableCell align="center">Allocation Method</TableCell>
                  <TableCell align="right">Opening Balance</TableCell>
                  <TableCell align="right">Opening Market Value</TableCell>
                  <TableCell align="right">Opening Quantity</TableCell>
                  <TableCell align="right">Purchases</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No historic cost data found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={r.symbol || i} hover> {/* Use symbol as key if unique */}
                      <TableCell>{r.symbol}</TableCell>
                      <TableCell align="center">{r.allocation}</TableCell>
                      <TableCell align="right">${r.openingBalance.toFixed(2)}</TableCell>
                      <TableCell align="right">$0.00</TableCell> {/* Confirm if this is always 0.00 */}
                      <TableCell align="right">{r.openingQty}</TableCell>
                      <TableCell align="right">${r.purchases.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}

                {rows.length > 0 && (
                  <>
                    <TableRow
                      sx={(theme) => ({ // This 'theme' is a parameter from sx prop
                        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200], // Using theme grays
                        fontWeight: 'bold',
                      })}
                    >
                      <TableCell><b>Total</b></TableCell>
                      <TableCell />
                      <TableCell align="right"><b>${totalOpening.toFixed(2)}</b></TableCell>
                      <TableCell align="right"><b>$0.00</b></TableCell> {/* Ensure this total is correct */}
                      <TableCell align="right"><b>{totalQty}</b></TableCell>
                      <TableCell align="right"><b>${totalPurchases.toFixed(2)}</b></TableCell>
                    </TableRow>
                    {/* The Grand Total row seems to display the same values as Total, except for the last cell color.
                        If they are meant to be different, the calculation or data might need adjustment.
                        If they are the same, one row might be sufficient, or the distinction needs to be clarified.
                    */}
                    <TableRow
                      sx={(theme) => ({ // This 'theme' is a parameter from sx prop
                        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[300], // Darker/different theme grays
                        fontWeight: 'bold',
                      })}
                    >
                      <TableCell><b>Grand Total</b></TableCell>
                      <TableCell />
                      <TableCell align="right"><b>${totalOpening.toFixed(2)}</b></TableCell>
                      <TableCell align="right"><b>$0.00</b></TableCell>
                      <TableCell align="right"><b>{totalQty}</b></TableCell>
                      <TableCell 
                        align="right" 
                        // sx={{ color: "lightgreen", fontWeight: 600 }} // 'lightgreen' is not theme-aware
                        sx={(theme) => ({ color: theme.palette.success.main, fontWeight: 600 })} // Theme-aware success color
                      >
                        ${totalPurchases.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default HistoricCost;