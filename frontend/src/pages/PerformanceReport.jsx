import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  useTheme,
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Treemap, ResponsiveContainer } from "recharts";
import { ArrowBack, Download } from "@mui/icons-material"; // ✅ updated icon import
import { useNavigate } from "react-router-dom";
import { getToolFeature } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const PerformanceReport = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const theme = useTheme();
  const navigate = useNavigate();

  const { data: result, isLoading: loading } = useQuery({
    queryKey: ["performance", userId],
    queryFn:  () => getToolFeature("performance", userId),
    staleTime: 1_200_000, // 20 min — Group A engine
    enabled:  !authLoading && !!userId,
  });

  const data = useMemo(() => (result?.data ?? []).map(r => ({
    symbol:       r.symbol,
    price:        parseFloat(r.market_price   || 0),
    quantity:     parseFloat(r.quantity        || 0),
    value:        parseFloat(r.market_value    || 0),
    capitalGains: parseFloat(r.capital_gain    || 0),
    dividends:    parseFloat(r.dividend_income || 0),
    return:       parseFloat(r.total_return    || 0),
  })), [result]);

  const total = data.reduce(
    (acc, d) => {
      acc.value += d.value;
      acc.capitalGains += d.capitalGains;
      acc.dividends += d.dividends;
      acc.return += d.return;
      return acc;
    },
    { value: 0, capitalGains: 0, dividends: 0, return: 0 }
  );

  const chartColor = theme.palette.mode === "dark" ? "#42a5f5" : "#64b5f6";

  const renderCustomContent = (props) => {
    const { x, y, width, height, name, root, value } = props;
    const percent = ((value / root.value) * 100).toFixed(1);
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: chartColor,
            stroke: "#fff",
            strokeWidth: 1,
          }}
        />
        {width > 60 && height > 30 && (
          <>
            <text x={x + 6} y={y + 20} fontSize={14} fill="#fff" fontWeight="bold">
              {name}
            </text>
            <text x={x + 6} y={y + 38} fontSize={12} fill="#fff">
              {percent}%
            </text>
          </>
        )}
      </g>
    );
  };

  const exportToCSV = () => {
    const headers = ["Symbol", "Price", "Quantity", "Value", "Capital Gains", "Dividends", "Return"];
    const rows = data.map((r) => [
      r.symbol,
      r.price,
      r.quantity,
      r.value,
      r.capitalGains,
      r.dividends,
      r.return,
    ]);
    const csvContent = [headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "performance_report.csv");
    link.click();
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* ✅ Header with back + export */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
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
            Performance
          </Typography>
        </Box>

        {/* ✅ Styled Export Icon */}
        <Tooltip title="Download as CSV">
          <IconButton
            onClick={exportToCSV}
            sx={{
              backgroundColor: "#90caf9",
              color: "#fff",
              '&:hover': {
                backgroundColor: "#64b5f6",
              },
              width: 48,
              height: 48,
              borderRadius: "50%",
            }}
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
        <>
          <Paper sx={{ mb: 4, p: 2 }}>
            <ResponsiveContainer width="100%" height={300}>
              <Treemap
                data={data.map((d) => ({ name: d.symbol, size: Math.abs(d.return) }))}
                dataKey="size"
                nameKey="name"
                stroke="#fff"
                fill={chartColor}
                content={renderCustomContent}
              />
            </ResponsiveContainer>
          </Paper>

          <Paper elevation={3}>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>ASX</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Value</TableCell>
                    <TableCell align="right">Capital Gains</TableCell>
                    <TableCell align="right">Dividends</TableCell>
                    <TableCell align="right">Return</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{row.symbol}</TableCell>
                      <TableCell align="right">${row.price.toFixed(2)}</TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                      <TableCell align="right">${row.value.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.capitalGains.toFixed(2)}</TableCell>
                      <TableCell align="right">${row.dividends.toFixed(2)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          color: row.return < 0 ? "error.main" : "success.light",
                          fontWeight: 600,
                        }}
                      >
                        ${row.return.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow
                    sx={{
                      backgroundColor: theme.palette.mode === "dark" ? "#151515" : "#f5f5f5",
                    }}
                  >
                    <TableCell><b>Grand Total</b></TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell align="right"><b>${total.value.toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total.capitalGains.toFixed(2)}</b></TableCell>
                    <TableCell align="right"><b>${total.dividends.toFixed(2)}</b></TableCell>
                    <TableCell align="right" sx={{ color: "success.light", fontWeight: 600 }}>
                      ${total.return.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default PerformanceReport;
