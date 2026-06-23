import React, { useState, useEffect } from "react";
import {
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Box,
  Alert,
  Autocomplete,
  FormHelperText,
} from "@mui/material";
import { supabase } from "../lib/supabase";

const TRANSACTION_TYPES = ["Buy", "Sell", "Dividend"];
const MARKETS = ["ASX", "NASDAQ", "NYSE", "LSE", "TSX", "Other"];
const CURRENCIES = ["AUD", "USD", "GBP", "EUR", "CAD", "Other"];

const AddTransactionForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    type: "Buy",
    date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
    market: "",
    code: "",
    securityName: "",
    quantity: "",
    price: "",
    brokerage: "",
    currency: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [markets, setMarkets] = useState(MARKETS);
  const [currencies, setCurrencies] = useState(CURRENCIES);
  const [securities, setSecurities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState(null);

  // Load securities and brokers for autocomplete
  useEffect(() => {
    const fetchData = async () => {
      // Fetch securities
      const { data: securitiesData } = await supabase
        .from("securities")
        .select("symbol, name, exchange, currency")
        .order("symbol", { ascending: true });

      if (securitiesData) {
        setSecurities(securitiesData);
      }

      // Fetch brokers
      const { data: brokersData } = await supabase
        .from("brokers")
        .select("id, name")
        .order("name", { ascending: true });

      if (brokersData) {
        setBrokers(brokersData);
      }

      // Get unique markets from securities
      if (securitiesData && securitiesData.length > 0) {
        const uniqueMarkets = [...new Set(securitiesData.map(s => s.exchange))].filter(Boolean);
        if (uniqueMarkets.length > 0) {
          setMarkets([...uniqueMarkets, ...MARKETS.filter(m => !uniqueMarkets.includes(m))]);
        }
      }

      // Get unique currencies from securities
      if (securitiesData && securitiesData.length > 0) {
        const uniqueCurrencies = [...new Set(securitiesData.map(s => s.currency))].filter(Boolean);
        if (uniqueCurrencies.length > 0) {
          setCurrencies([...uniqueCurrencies, ...CURRENCIES.filter(c => !uniqueCurrencies.includes(c))]);
        }
      }
    };

    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };

  const handleSecuritySelect = (event, value) => {
    if (value) {
      setFormData({
        ...formData,
        code: value.symbol,
        market: value.exchange || formData.market,
        currency: value.currency || formData.currency,
        securityName: value.name || value.symbol,
      });
    }
  };

  const handleBrokerSelect = (event, value) => {
    setSelectedBroker(value);
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.type) newErrors.type = "Transaction type is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.market) newErrors.market = "Market is required";
    if (!formData.code) newErrors.code = "Security code is required";
    if (!formData.currency) newErrors.currency = "Currency is required";
    
    // Check if quantity is required based on transaction type
    if (formData.type !== "Dividend" && (!formData.quantity || formData.quantity <= 0)) {
      newErrors.quantity = "Valid quantity is required";
    }
    
    // Price is required for all transaction types
    if (!formData.price || formData.price <= 0) {
      newErrors.price = "Valid price is required";
    }
    
    // Brokerage cannot be negative
    if (formData.brokerage && formData.brokerage < 0) {
      newErrors.brokerage = "Brokerage cannot be negative";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    
    const submissionData = {
      ...formData,
      quantity: formData.quantity ? parseFloat(formData.quantity) : null,
      price: parseFloat(formData.price),
      brokerage: formData.brokerage ? parseFloat(formData.brokerage) : null,
      brokerId: selectedBroker?.id || null,
    };
    
    onSubmit(submissionData);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Transaction Type */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth error={!!errors.type}>
            <InputLabel>Transaction Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Transaction Type"
            >
              {TRANSACTION_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
            {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
          </FormControl>
        </Grid>

        {/* Date - Simple date input instead of MUI DatePicker */}
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label="Transaction Date"
            name="date"
            type="date"
            value={formData.date}
            onChange={handleChange}
            fullWidth
            error={!!errors.date}
            helperText={errors.date}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </Grid>

        {/* Market */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth error={!!errors.market}>
            <InputLabel>Market</InputLabel>
            <Select
              name="market"
              value={formData.market}
              onChange={handleChange}
              label="Market"
            >
              {markets.map((market) => (
                <MenuItem key={market} value={market}>
                  {market}
                </MenuItem>
              ))}
            </Select>
            {errors.market && <FormHelperText>{errors.market}</FormHelperText>}
          </FormControl>
        </Grid>

        {/* Broker */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            options={brokers}
            getOptionLabel={(option) => option.name}
            value={selectedBroker}
            onChange={handleBrokerSelect}
            renderInput={(params) => (
              <TextField {...params} label="Broker (Optional)" fullWidth />
            )}
          />
        </Grid>

        {/* Security Code */}
        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={securities}
            getOptionLabel={(option) => `${option.symbol} - ${option.name || option.symbol}`}
            onChange={handleSecuritySelect}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Security"
                name="code"
                error={!!errors.code}
                helperText={errors.code}
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Manual Code Entry (if not found in autocomplete) */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Security Code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            fullWidth
            error={!!errors.code}
            helperText={errors.code || "Enter code manually if not found in dropdown"}
          />
        </Grid>

        {/* Security Name */}
        <Grid item xs={12} sm={6}>
          <TextField
            label="Security Name (Optional)"
            name="securityName"
            value={formData.securityName}
            onChange={handleChange}
            fullWidth
          />
        </Grid>

        {/* Currency */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={!!errors.currency}>
            <InputLabel>Currency</InputLabel>
            <Select
              name="currency"
              value={formData.currency}
              onChange={handleChange}
              label="Currency"
            >
              {currencies.map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </Select>
            {errors.currency && <FormHelperText>{errors.currency}</FormHelperText>}
          </FormControl>
        </Grid>

        {/* Quantity */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="Quantity"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleChange}
            fullWidth
            error={!!errors.quantity}
            helperText={errors.quantity}
            disabled={formData.type === "Dividend"}
            InputProps={{
              inputProps: { step: "any", min: "0" },
            }}
          />
        </Grid>

        {/* Price */}
        <Grid item xs={12} sm={4}>
          <TextField
            label={formData.type === "Dividend" ? "Amount" : "Price"}
            name="price"
            type="number"
            value={formData.price}
            onChange={handleChange}
            fullWidth
            error={!!errors.price}
            helperText={errors.price}
            InputProps={{
              inputProps: { step: "any", min: "0" },
              startAdornment: formData.currency ? (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ) : null,
            }}
          />
        </Grid>

        {/* Brokerage */}
        <Grid item xs={12} sm={4}>
          <TextField
            label="Brokerage Fee"
            name="brokerage"
            type="number"
            value={formData.brokerage}
            onChange={handleChange}
            fullWidth
            error={!!errors.brokerage}
            helperText={errors.brokerage}
            disabled={formData.type === "Dividend"}
            InputProps={{
              inputProps: { step: "any", min: "0" },
              startAdornment: formData.currency ? (
                <InputAdornment position="start">{formData.currency}</InputAdornment>
              ) : null,
            }}
          />
        </Grid>

        {/* Notes */}
        <Grid item xs={12}>
          <TextField
            label="Notes (Optional)"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            fullWidth
            multiline
            rows={2}
          />
        </Grid>

        {/* Buttons */}
        <Grid item xs={12}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2 }}>
            <Button variant="outlined" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Add Transaction"}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
};

export default AddTransactionForm; 