import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Box,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  Delete,
  Info,
  TrendingUp,
  TrendingDown,
  Payments,
} from "@mui/icons-material";

const TransactionTable = ({ transactions, onDelete }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterType, setFilterType] = useState("All");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "-";

    const number = Number(value);
    if (!Number.isFinite(number)) return "-";

    return number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatQuantity = (value) => {
    if (value === null || value === undefined || value === "") return "-";

    const number = Number(value);
    if (!Number.isFinite(number)) return "-";

    return number.toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const transactionTypes = useMemo(() => {
    const types = new Set(
      transactions.map((item) => item.type).filter(Boolean),
    );
    return ["All", ...Array.from(types).sort()];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (filterType === "All") return true;
      return transaction.type === filterType;
    });
  }, [transactions, filterType]);

  const visibleRows = useMemo(() => {
    return filteredTransactions.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    );
  }, [filteredTransactions, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (event) => {
    setFilterType(event.target.value);
    setPage(0);
  };

  const handleDeleteClick = (transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (transactionToDelete) {
      onDelete(transactionToDelete.id);
    }

    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "Buy":
        return <TrendingUp color="success" />;
      case "Sell":
        return <TrendingDown color="error" />;
      case "Dividend":
        return <Payments color="primary" />;
      default:
        return <Info />;
    }
  };

  const getTypeChip = (type) => {
    let color;

    switch (type) {
      case "Buy":
        color = "success";
        break;
      case "Sell":
        color = "error";
        break;
      case "Dividend":
        color = "primary";
        break;
      default:
        color = "default";
    }

    return (
      <Chip
        icon={getTypeIcon(type)}
        label={type || "Unknown"}
        size="small"
        color={color}
        variant="outlined"
      />
    );
  };

  return (
    <Box>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Box>
          <strong>{filteredTransactions.length}</strong> transactions shown
        </Box>

        <TextField
          select
          label="Filter by Type"
          value={filterType}
          onChange={handleFilterChange}
          size="small"
          sx={{ width: 220 }}
        >
          {transactionTypes.map((type) => (
            <MenuItem key={type} value={type}>
              {type === "All" ? "All Transactions" : type}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 1150 }} size="medium">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Market</TableCell>
              <TableCell>Code</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Brokerage</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Franking %</TableCell>
              <TableCell align="right">Franking Credits</TableCell>
              <TableCell align="right">Reduced Cost Base</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{getTypeChip(row.type)}</TableCell>

                <TableCell>{formatDate(row.date)}</TableCell>

                <TableCell>{row.market || "-"}</TableCell>

                <TableCell>
                  <Tooltip title={row.securityName || ""}>
                    <span>{row.code || "-"}</span>
                  </Tooltip>
                </TableCell>

                <TableCell align="right">
                  {formatQuantity(row.quantity)}
                </TableCell>

                <TableCell align="right">{formatNumber(row.price)}</TableCell>

                <TableCell align="right">
                  {formatNumber(row.brokerage)}
                </TableCell>

                <TableCell>{row.currency || "-"}</TableCell>

                <TableCell align="right">
                  {formatNumber(row.totalAmount)}
                </TableCell>

                <TableCell align="right">
                  {row.frankingPercent === null ||
                  row.frankingPercent === undefined ||
                  row.frankingPercent === ""
                    ? "-"
                    : `${formatNumber(row.frankingPercent)}%`}
                </TableCell>

                <TableCell align="right">
                  {formatNumber(row.frankingCredits)}
                </TableCell>

                <TableCell align="right">
                  {formatNumber(row.reducedCostBase)}
                </TableCell>

                <TableCell>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteClick(row)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} align="center">
                  No transactions found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={filteredTransactions.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-transaction-title"
        aria-describedby="delete-transaction-description"
      >
        <DialogTitle id="delete-transaction-title">
          Confirm Delete Transaction
        </DialogTitle>

        <DialogContent>
          <DialogContentText id="delete-transaction-description">
            Are you sure you want to delete this transaction?
            {transactionToDelete && (
              <Box component="span" sx={{ display: "block", mt: 2 }}>
                {transactionToDelete.type} {transactionToDelete.quantity}{" "}
                {transactionToDelete.code} at {transactionToDelete.price}{" "}
                {transactionToDelete.currency} on{" "}
                {formatDate(transactionToDelete.date)}
              </Box>
            )}
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>

          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TransactionTable;
