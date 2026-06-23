import React, { useState } from "react";
import Papa from "papaparse";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  LinearProgress,
  Divider,
  Chip,
  Stack,
  IconButton,
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
} from "@mui/material";
import {
  Upload as UploadIcon,
  ListAlt,
  CheckCircle,
  Error as ErrorIcon,
  Cancel,
} from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import { supabase } from "../lib/supabase";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 1.5,
  boxShadow: theme.shadows[2],
  transition: "box-shadow 0.3s ease-in-out",
  "&:hover": {
    boxShadow: theme.shadows[5],
  },
}));

// Map of broker templates
const brokerTemplates = {
  sharesight: "Sharesight Format",
  "180markets": "180 Markets",
  "708wealth": "708 Wealth Management",
  alpine: "Alpine Capital",
  asr: "ASR Wealth Advisers",
  hsbc: "HSBC Australia",
};

const EnhancedCSVUploader = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, validating, success, error
  const [selectedBroker, setSelectedBroker] = useState("sharesight");

  const handleBrokerChange = (event) => {
    setSelectedBroker(event.target.value);
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setUploadStatus("validating");
    setLoading(true);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`Error parsing CSV: ${results.errors[0].message}`);
          setUploadStatus("error");
          setLoading(false);
          return;
        }

        try {
          // Process the data based on broker format
          const processedData = processBrokerData(results.data, selectedBroker);
          setParsedData(processedData);
          setPreview(processedData.slice(0, 5)); // Show first 5 rows
          setUploadStatus("success");
        } catch (err) {
          setError(err.message);
          setUploadStatus("error");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Process different broker CSV formats
  const processBrokerData = (data, broker) => {
    // Check if data is empty
    if (!data || data.length === 0) {
      throw new Error("CSV file is empty or improperly formatted");
    }

    // Get field names from first row
    const fields = Object.keys(data[0]);

    // Handle different broker formats
    if (broker === "hsbc") {
      // HSBC format
      if (
        !fields.includes("Stock Code") ||
        !fields.includes("Transaction Type")
      ) {
        throw new Error("This doesn't appear to be a valid HSBC CSV format");
      }

      return data.map((row) => ({
        transactionType: mapTransactionType(row["Transaction Type"]),
        date: formatDate(row["Transaction Date"]),
        market: "ASX", // Assuming ASX for HSBC Australia
        code: row["Stock Code"],
        quantity: parseNumber(row["Quantity"]),
        price: parseNumber(row["Price per Share"]),
        brokerage: parseNumber(row["Brokerage"]),
        currency: "AUD", // Assuming AUD for HSBC Australia
        exchangeRate: 1.0,
        comment: row["Comments"] || "",
      }));
    } else if (broker === "sharesight") {
      // Sharesight format
      const requiredColumns = [
        "Transaction Type",
        "Date",
        "Market",
        "Code",
        "Quantity",
        "Price",
        "Currency",
      ];
      const missingColumns = requiredColumns.filter(
        (col) => !fields.includes(col),
      );

      if (missingColumns.length > 0) {
        throw new Error(
          `CSV is missing required Sharesight columns: ${missingColumns.join(", ")}`,
        );
      }

      return data.map((row) => ({
        transactionType: row["Transaction Type"],
        date: row.Date,
        market: row.Market,
        code: row.Code,
        quantity: parseNumber(row.Quantity),
        price: parseNumber(row.Price),
        brokerage: parseNumber(row.Brokerage),
        currency: row.Currency,
        exchangeRate: parseNumber(row["Exchange Rate"] || "1.0"),
        comment: row.Comment || "",
      }));
    } else {
      // Standard format for other brokers (180markets, 708wealth, alpine, asr, etc.)
      if (!fields.includes("Code") || !fields.includes("Type")) {
        throw new Error(
          `This doesn't appear to be a valid ${brokerTemplates[broker]} CSV format`,
        );
      }

      return data.map((row) => ({
        transactionType: mapTransactionType(row["Type"]),
        date: row["Date"],
        market: row["Market Code"],
        code: row["Code"],
        quantity: parseNumber(row["Quantity"]),
        price: parseNumber(row["Price"]),
        brokerage: parseNumber(row["Brokerage"]),
        currency: row["Instrument Currency"],
        exchangeRate: parseNumber(row["Exchange Rate"] || "1.0"),
        comment: row["Comments"] || "",
      }));
    }
  };

  // Helper to standardize transaction types
  const mapTransactionType = (type) => {
    if (!type) return "Buy"; // Default to Buy if no type specified

    type = type.toLowerCase();
    if (type.includes("buy") || type === "purchase") return "Buy";
    if (type.includes("sell") || type === "sale") return "Sell";
    if (type.includes("div")) return "Dividend";
    return type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first letter
  };

  // Helper to format dates to YYYY-MM-DD
  const formatDate = (dateStr) => {
    if (!dateStr) return "";

    // Check for DD/MM/YYYY format
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        // Assuming DD/MM/YYYY format
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
    }

    return dateStr; // Return as is if already in YYYY-MM-DD format
  };

  // Helper to parse numbers
  const parseNumber = (value) => {
    if (!value || value === "") return null;
    return parseFloat(value.toString().replace(/,/g, ""));
  };

  const saveToDatabase = async () => {
    if (!parsedData.length) return;

    setLoading(true);
    setError(null);

    try {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to upload data");
      }

      // Get or create the broker
      const { data: brokerData, error: brokerError } = await supabase
        .from("brokers")
        .select("id")
        .eq("name", brokerTemplates[selectedBroker])
        .single();

      let brokerId;

      if (brokerError || !brokerData) {
        // Create the broker
        const { data: newBroker, error: createBrokerError } = await supabase
          .from("brokers")
          .insert({
            user_id: user.id,
            name: brokerTemplates[selectedBroker],
            description: `${brokerTemplates[selectedBroker]} broker account`,
          })
          .select("id")
          .single();

        if (createBrokerError) {
          throw new Error(
            `Error creating broker: ${createBrokerError.message}`,
          );
        }

        brokerId = newBroker.id;
      } else {
        brokerId = brokerData.id;
      }

      // Process each transaction
      for (const transaction of parsedData) {
        // First, ensure the security exists or create it
        const { data: securityData, error: securityError } = await supabase
          .from("securities")
          .select("id")
          .eq("symbol", transaction.code)
          .eq("exchange", transaction.market)
          .single();

        let securityId;

        if (securityError || !securityData) {
          // Create the security
          const { data: newSecurity, error: createSecurityError } =
            await supabase
              .from("securities")
              .insert({
                symbol: transaction.code,
                name: transaction.code, // Use symbol as name for now
                asset_class: "Equity", // Default
                currency: transaction.currency,
                exchange: transaction.market,
              })
              .select("id")
              .single();

          if (createSecurityError) {
            throw new Error(
              `Error creating security: ${createSecurityError.message}`,
            );
          }

          securityId = newSecurity.id;
        } else {
          securityId = securityData.id;
        }

        // Now create the activity
        const { error: activityError } = await supabase
          .from("activities")
          .insert({
            user_id: user.id,
            security_id: securityId,
            broker_id: brokerId,
            type: transaction.transactionType.toLowerCase(),
            date: transaction.date,
            quantity: transaction.quantity,
            price: transaction.price,
            total_amount:
              transaction.transactionType === "Dividend"
                ? transaction.price
                : transaction.price * transaction.quantity +
                  (transaction.brokerage || 0),
            fees: transaction.brokerage,
            currency: transaction.currency,
            notes: transaction.comment,
          });

        if (activityError) {
          throw new Error(`Error recording activity: ${activityError.message}`);
        }
      }

      // Call the callback to notify parent component
      if (onUploadComplete) {
        onUploadComplete(parsedData);
      }
    } catch (err) {
      console.error("Error saving to database:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancelUpload = () => {
    setFile(null);
    setParsedData([]);
    setPreview([]);
    setError(null);
    setUploadStatus("idle");
  };

  return (
    <StyledPaper>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="h5" fontWeight="medium" sx={{ mb: 2 }}>
          Import Transactions
        </Typography>

        {/* Broker template selector */}
        {uploadStatus === "idle" && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="broker-template-label">
              Select CSV Format
            </InputLabel>
            <Select
              labelId="broker-template-label"
              id="broker-template"
              value={selectedBroker}
              label="Select CSV Format"
              onChange={handleBrokerChange}
            >
              {Object.entries(brokerTemplates).map(([key, name]) => (
                <MenuItem key={key} value={key}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* File upload area */}
        {uploadStatus === "idle" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              p: 3,
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <UploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
            <Typography variant="h6" align="center" gutterBottom>
              Drag & Drop or Select CSV File
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              align="center"
              sx={{ mb: 3 }}
            >
              Upload a CSV file in {brokerTemplates[selectedBroker]} format
            </Typography>
            <Button
              component="label"
              variant="contained"
              startIcon={<UploadIcon />}
            >
              Select File
              <VisuallyHiddenInput
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
            </Button>
          </Box>
        )}

        {/* Loading indicator */}
        {loading && (
          <Box sx={{ width: "100%" }}>
            <LinearProgress />
          </Box>
        )}

        {/* Error message */}
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={cancelUpload}>
                Try Again
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Success preview */}
        {uploadStatus === "success" && (
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <CheckCircle color="success" />
                <Typography variant="subtitle1">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </Typography>
                <Chip
                  label={`${parsedData.length} transactions`}
                  color="primary"
                  size="small"
                  icon={<ListAlt />}
                />
              </Stack>
              <IconButton color="error" onClick={cancelUpload}>
                <Cancel />
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Preview:
            </Typography>

            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Market</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell>Currency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.transactionType}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.market}</TableCell>
                      <TableCell>{row.code}</TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                      <TableCell align="right">{row.price}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="error"
                onClick={cancelUpload}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={saveToDatabase}
                disabled={loading}
                startIcon={loading ? null : <CheckCircle />}
              >
                {loading ? "Saving..." : "Import Transactions"}
              </Button>
            </Stack>
          </Box>
        )}
      </Box>
    </StyledPaper>
  );
};

export default EnhancedCSVUploader;
