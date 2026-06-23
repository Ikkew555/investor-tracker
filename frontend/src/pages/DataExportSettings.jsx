import React, { useState } from "react";
import {
  Button,
  FormControl,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Typography,
  Box,
  Paper,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  CircularProgress,
  Divider,
} from "@mui/material";
import { 
  FileDownload as FileDownloadIcon,
  TableChart as TableIcon,
  // BarChart as BarChartIcon, // Re-used for Goals, that's fine
  // Settings as SettingsIcon, // Re-used for Accounts, that's fine
  Timeline as TimelineIcon,
  AccountBalanceWallet as AccountsIcon, // Example: different icon for Accounts
  Assessment as ActivitiesIcon, // Example: different icon for Activities
  Flag as GoalsIcon, // Example: different icon for Goals
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import {
  activities as activitiesAPI,
  brokers as brokersAPI,
  settings as settingsAPI
} from "../lib/supabase";

// Removed userSettings prop as it was unused
function DataExportSettings({ setError, setSuccess }) {
  const { user } = useAuth();
  const [selectedExports, setSelectedExports] = useState({
    accounts: true,
    activities: true,
    goals: false,
  });
  const [exportFormat, setExportFormat] = useState("json");
  const [loading, setLoading] = useState(false);

  const handleExportTypeChange = (event) => {
    setSelectedExports({
      ...selectedExports,
      [event.target.name]: event.target.checked,
    });
  };

  const handleFormatChange = (event) => {
    setExportFormat(event.target.value);
  };

  // Removed unnecessary try/catch from here; errors will propagate to handleExport
  const prepareExportData = async () => {
    const exportData = {};
    
    if (!user) { // Guard clause
        throw new Error("User not authenticated for data export.");
    }
    
    // Fetch accounts (brokers)
    if (selectedExports.accounts) {
      const { data: accountsData, error: accountsError } = await brokersAPI.getBrokers(user.id);
      if (accountsError) throw accountsError;
      exportData.accounts = accountsData || []; // Ensure it's an array
    }
    
    // Fetch activities
    if (selectedExports.activities) {
      const { data: activitiesData, error: activitiesError } = await activitiesAPI.getActivities(user.id);
      if (activitiesError) throw activitiesError;
      exportData.activities = activitiesData || []; // Ensure it's an array
    }
    
    // Fetch goals from settings
    if (selectedExports.goals) {
      const { data: settingsFromDB, error: settingsError } = await settingsAPI.getSettings(user.id);
      if (settingsError) throw settingsError;
      exportData.goals = settingsFromDB?.notification_preferences?.investment_goals || [];
    }
    
    return exportData;
  };

  const handleExport = async () => {
    if (!Object.values(selectedExports).some(Boolean)) {
      if (setError) setError("Please select at least one data type to export");
      return;
    }
    
    setLoading(true);
    // Clear previous messages
    if (setError) setError(null);
    if (setSuccess) setSuccess(null);

    try {
      const exportData = await prepareExportData();
      
      let dataStr, fileExt, contentType;
      
      switch (exportFormat) {
        case "json":
          dataStr = JSON.stringify(exportData, null, 2);
          fileExt = "json";
          contentType = "application/json;charset=utf-8;";
          break;
        case "csv":
          dataStr = convertToCSV(exportData);
          fileExt = "csv";
          contentType = "text/csv;charset=utf-8;";
          break;
        case "sql":
          dataStr = convertToSQL(exportData);
          fileExt = "sql";
          contentType = "application/sql;charset=utf-8;";
          break;
        default: // Fallback to JSON
          dataStr = JSON.stringify(exportData, null, 2);
          fileExt = "json";
          contentType = "application/json;charset=utf-8;";
      }
      
      const dataBlob = new Blob([dataStr], { type: contentType });
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `portfolio_export_${new Date().toISOString().slice(0,10)}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link); // Clean up the link
      window.URL.revokeObjectURL(url); // Clean up the blob URL
      
      if (setSuccess) setSuccess("Data exported successfully!");
    } catch (err) {
      console.error("Error exporting data:", err);
      if (setError) setError(`Failed to export data: ${err.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const convertToCSV = (data) => {
    const csvParts = [];
    Object.entries(data).forEach(([key, records]) => {
      if (!records || !Array.isArray(records) || records.length === 0) return;
      csvParts.push(`\n# ${key.toUpperCase()}\n`);
      const headers = Object.keys(records[0]);
      csvParts.push(headers.join(",") + "\n");
      records.forEach(record => {
        const row = headers.map(header => {
          let value = record[header];
          if (value === null || value === undefined) value = '';
          else if (typeof value === 'object') value = JSON.stringify(value);
          
          const valueStr = String(value);
          // Escape double quotes and wrap in double quotes if it contains comma, newline or double quote
          if (valueStr.includes(',') || valueStr.includes('\n') || valueStr.includes('"')) {
            return `"${valueStr.replace(/"/g, '""')}"`;
          }
          return valueStr;
        }).join(",");
        csvParts.push(row + "\n");
      });
    });
    return csvParts.join("");
  };

  const convertToSQL = (data) => {
    const sqlParts = [];
    sqlParts.push(`-- Portfolio Tracker Export\n-- Generated: ${new Date().toISOString()}\n\n`);
    Object.entries(data).forEach(([tableName, records]) => {
      if (!records || !Array.isArray(records) || records.length === 0) return;
      sqlParts.push(`-- Data for table: ${tableName.toUpperCase()}\n`);
      records.forEach(record => {
        const columns = Object.keys(record).map(col => `"${col}"`); // Quote column names
        const values = Object.values(record).map(value => {
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
          if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
          if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`; // Stringify objects/arrays
          return value; // Numbers
        });
        sqlParts.push(`INSERT INTO "${tableName}" (${columns.join(", ")}) VALUES (${values.join(", ")});\n`);
      });
      sqlParts.push("\n");
    });
    return sqlParts.join("");
  };

  const selectAll = () => {
    setSelectedExports({ accounts: true, activities: true, goals: true });
  };

  const selectNone = () => {
    setSelectedExports({ accounts: false, activities: false, goals: false });
  };

  return (
    <div className="data-export-settings">
      <div className="data-export-header" style={{ marginBottom: '24px' }}> {/* Added style */}
        <Typography variant="h5" component="h2" gutterBottom>Data Export</Typography> {/* Changed to h5 */}
        <Typography variant="body1" color="text.secondary"> {/* Changed to body1 */}
          Export your portfolio data in various formats.
        </Typography>
      </div>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Select Data to Export</Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Button size="small" onClick={selectAll}>Select All</Button>
              <Button size="small" onClick={selectNone}>Clear All</Button>
            </Box>
            <FormGroup>
              <FormControlLabel control={<Checkbox checked={selectedExports.accounts} onChange={handleExportTypeChange} name="accounts"/>}
                label={<Box display="flex" alignItems="center"><AccountsIcon fontSize="small" sx={{ mr: 1 }} /><span>Accounts (Brokers)</span></Box>}
              />
              <FormControlLabel control={<Checkbox checked={selectedExports.activities} onChange={handleExportTypeChange} name="activities"/>}
                label={<Box display="flex" alignItems="center"><ActivitiesIcon fontSize="small" sx={{ mr: 1 }} /><span>Activities (Transactions)</span></Box>}
              />
              <FormControlLabel control={<Checkbox checked={selectedExports.goals} onChange={handleExportTypeChange} name="goals"/>}
                label={<Box display="flex" alignItems="center"><GoalsIcon fontSize="small" sx={{ mr: 1 }} /><span>Investment Goals</span></Box>}
              />
            </FormGroup>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Export Settings</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}> {/* Reduced mb */}
              <InputLabel id="export-format-label">Export Format</InputLabel>
              <Select labelId="export-format-label" value={exportFormat} onChange={handleFormatChange} label="Export Format">
                <MenuItem value="json">JSON - Structured Data</MenuItem>
                <MenuItem value="csv">CSV - Spreadsheet Compatible</MenuItem>
                <MenuItem value="sql">SQL - Database Import Script</MenuItem>
              </Select>
            </FormControl>
            <Divider sx={{ my: 1 }} /> {/* Reduced my */}
            <Box sx={{ mt: 'auto', textAlign: 'center' }}>
              <Button
                variant="contained" color="primary" fullWidth
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
                onClick={handleExport}
                disabled={loading || !Object.values(selectedExports).some(Boolean)}
              >
                {loading ? "Exporting..." : "Export Data"}
              </Button>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                Your data will be exported locally to your device.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default DataExportSettings;