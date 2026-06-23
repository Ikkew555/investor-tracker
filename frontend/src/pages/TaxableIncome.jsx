import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  useTheme, // theme is used in sx prop later, so useTheme() call is fine
  IconButton,
  Tooltip,
} from "@mui/material";
import { ArrowBack, Download } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { getDividendEvents, getTaxMeta, DEFAULT_FY } from "../services/taxApi";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";

const TaxableIncome = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const theme = useTheme();
  const enabled = !authLoading && !!userId;

  // Step 1: fetch tax meta to discover which FY has data
  const { data: metaRes } = useQuery({
    queryKey: ["tax-meta", userId],
    queryFn:  () => getTaxMeta(userId),
    staleTime: 86_400_000,
    enabled,
  });
  const activeFY = metaRes?.data?.financial_years?.[0]?.financial_year || DEFAULT_FY;

  // Step 2: fetch dividend events for that FY
  const { data: res, isLoading: loading } = useQuery({
    queryKey: ["dividend-events", userId, activeFY],
    queryFn:  () => getDividendEvents(userId, activeFY),
    staleTime: 86_400_000,
    enabled:  enabled && !!activeFY,
  });

  const incomeRows = useMemo(() => (res?.data ?? []).map(row => {
    const cash           = parseFloat(row.cash_amount        || 0);
    const frankingPct    = parseFloat(row.franking_percent   || 0);
    const frankingCredit = parseFloat(row.franking_credits   || 0);
    const grossed        = parseFloat(row.grossed_up_dividend || 0);
    return {
      holding:         row.symbol,
      paidDate:        new Date(row.payment_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }),
      totalIncome:     cash,
      franked:         parseFloat((cash * (frankingPct / 100)).toFixed(2)),
      unfranked:       parseFloat((cash * (1 - frankingPct / 100)).toFixed(2)),
      withholdingTax:  0,
      frankingCredits: frankingCredit,
      grossIncome:     grossed || cash + frankingCredit,
    };
  }), [res]);

  const total = (key) => incomeRows.reduce((sum, r) => sum + r[key], 0);

  const exportToExcel = () => {
    // Prepare data for export, ensuring numbers are formatted as numbers if needed
    const exportData = incomeRows.map(row => ({
      Holding: row.holding,
      "Paid Date": row.paidDate,
      "Total Income": row.totalIncome,
      "Franked": row.franked,
      "Unfranked": row.unfranked,
      "Withholding Tax": row.withholdingTax,
      "Franking Credits": row.frankingCredits,
      "Gross Income": row.grossIncome,
    }));

    // Add totals row for export
    if (incomeRows.length > 0) {
        exportData.push({
            Holding: "Total",
            "Paid Date": "",
            "Total Income": total("totalIncome"),
            "Franked": total("franked"),
            "Unfranked": total("unfranked"),
            "Withholding Tax": total("withholdingTax"),
            "Franking Credits": total("frankingCredits"),
            "Gross Income": total("grossIncome"),
        });
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TaxableIncome");
    XLSX.writeFile(workbook, "TaxableIncomeReport.xlsx");
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate("/reports")}
            sx={{ mr: 2 }}
          >
            Back to Reports
          </Button>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Taxable Income
          </Typography>
        </Box>
        <Tooltip title="Download as XLSX">
          <IconButton onClick={exportToExcel} disabled={incomeRows.length === 0}>
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
                  <TableCell>Holding</TableCell>
                  <TableCell>Paid Date</TableCell>
                  <TableCell align="right">Total Income</TableCell>
                  <TableCell align="right">Franked</TableCell>
                  <TableCell align="right">Unfranked</TableCell>
                  <TableCell align="right">Withholding Tax</TableCell>
                  <TableCell align="right">Franking Credits</TableCell>
                  <TableCell align="right">Gross Income</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incomeRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No income data available
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeRows.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{row.holding}</TableCell>
                      <TableCell>{row.paidDate}</TableCell>
                      <TableCell align="right">${row.totalIncome.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.franked.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.unfranked.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.withholdingTax.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.frankingCredits.toFixed(2)}</TableCell>
                      <TableCell align="right" style={{ color: theme.palette.success.main, fontWeight: 600 }}> {/* Used theme here */}
                        ${row.grossIncome.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {incomeRows.length > 0 && (
                  <TableRow
                    sx={{ // theme is implicitly available here from useTheme() via the sx prop function signature
                      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200],
                      fontWeight: "bold",
                    }}
                  >
                    <TableCell><b>Total</b></TableCell>
                    <TableCell />
                    <TableCell align="right"><b>${total("totalIncome").toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total("franked").toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total("unfranked").toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total("withholdingTax").toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total("frankingCredits").toFixed(2)}</b></TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.success.main, fontWeight: "bold" }}> {/* Used theme here */}
                      ${total("grossIncome").toFixed(2)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default TaxableIncome;