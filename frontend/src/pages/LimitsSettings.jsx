import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import "../components/LimitsSettings.css";
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Grid,
  CircularProgress,
  Typography,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  Select,
  MenuItem,
  InputLabel,
} from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { settings, brokers } from "../lib/supabase";

function LimitsSettings({ userSettings, updateUserSettings, setError, setSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentLimit, setCurrentLimit] = useState({
    group_name: "",
    contribution_year: new Date().getFullYear(),
    limit_amount: "",
    assigned_accounts: [],
    contribution_amount: 0,
  });
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch user settings first to get any saved limits
      const { data: settingsData, error: settingsError } = await settings.getSettings(user.id);
      if (settingsError) throw settingsError;

      // Fetch accounts
      const { data: accountsData, error: accountsError } = await brokers.getBrokers(user.id);
      if (accountsError) throw accountsError;

      setAccounts(accountsData || []);

      // Extract limits from settings
      if (settingsData?.notification_preferences?.contribution_limits) {
        setLimits(settingsData.notification_preferences.contribution_limits);
      } else {
        setLimits([]); // Ensure limits is an array
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load contribution limits. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, setError]); // Added setError to dependency array

  useEffect(() => {
    fetchData();
  }, [user, fetchData]); // Added fetchData to dependency array

  const handleOpen = (limit = null) => {
    if (limit) {
      setCurrentLimit({
        ...limit,
        contribution_year: limit.contribution_year || new Date().getFullYear(),
        assigned_accounts: limit.assigned_accounts || [],
      });
      setEditMode(true);
    } else {
      setCurrentLimit({
        group_name: "",
        contribution_year: new Date().getFullYear(),
        limit_amount: "",
        assigned_accounts: [],
        contribution_amount: 0,
      });
      setEditMode(false);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedAccountId("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "limit_amount" && value && isNaN(parseFloat(value))) {
      return; // Allow only numbers for limit amount
    }
    if (name === "contribution_amount" && value && isNaN(parseFloat(value))) {
        return; 
    }
    setCurrentLimit({
      ...currentLimit,
      [name]: value,
    });
  };

  const handleAddAssignedAccount = () => {
    if (!selectedAccountId) return;
    
    // Check if account is already assigned
    if (currentLimit.assigned_accounts.includes(selectedAccountId)) {
      setError("This account is already assigned to this limit");
      return;
    }
    
    setCurrentLimit({
      ...currentLimit,
      assigned_accounts: [...currentLimit.assigned_accounts, selectedAccountId],
    });
    setSelectedAccountId("");
  };

  const handleRemoveAssignedAccount = (accountId) => {
    setCurrentLimit({
      ...currentLimit,
      assigned_accounts: currentLimit.assigned_accounts.filter(id => id !== accountId),
    });
  };

  const saveLimit = async () => {
    if (!currentLimit.group_name || !currentLimit.limit_amount) {
      setError("Group name and limit amount are required");
      return;
    }
    if (parseFloat(currentLimit.limit_amount) <= 0) {
        setError("Limit amount must be greater than zero.");
        return;
    }
    if (currentLimit.contribution_amount && parseFloat(currentLimit.contribution_amount) < 0) {
        setError("Contribution amount cannot be negative.");
        return;
    }


    setSaving(true);
    try {
      let updatedLimits = [...limits];
      
      if (editMode) {
        const index = limits.findIndex(l => l.group_name === currentLimit.group_name && l.contribution_year === currentLimit.contribution_year);
        if (index >= 0) {
          updatedLimits[index] = currentLimit;
        } else {
          // Fallback if not found (should ideally not happen if editMode is set correctly)
          updatedLimits.push(currentLimit);
        }
      } else {
        // Check for duplicate group name for the same year
        if (limits.some(l => l.group_name === currentLimit.group_name && l.contribution_year === currentLimit.contribution_year)) {
          setError(`A limit with the name "${currentLimit.group_name}" already exists for the year ${currentLimit.contribution_year}.`);
          setSaving(false);
          return;
        }
        updatedLimits.push(currentLimit);
      }
      
      const basePreferences = userSettings?.notification_preferences || {};
      // Update in Supabase
      const updatedPreferences = {
        ...basePreferences,
        contribution_limits: updatedLimits,
      };
      
      const { error } = await settings.updateSettings(user.id, {
        notification_preferences: updatedPreferences,
      });
      
      if (error) throw error;
      
      // Update local state
      setLimits(updatedLimits);
      updateUserSettings(prevSettings => ({
        ...prevSettings,
        notification_preferences: updatedPreferences,
      }));
      
      setSuccess(editMode ? "Limit updated successfully" : "Limit added successfully");
      handleClose();
    } catch (err) {
      console.error("Error saving limit:", err);
      setError("Failed to save contribution limit");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLimit = async (groupName, year) => {
    if (!window.confirm(`Are you sure you want to delete the contribution limit "${groupName}" for ${year}?`)) return;
    
    try {
      const updatedLimits = limits.filter(l => !(l.group_name === groupName && l.contribution_year === year));
      
      const basePreferences = userSettings?.notification_preferences || {};
      // Update in Supabase
      const updatedPreferences = {
        ...basePreferences,
        contribution_limits: updatedLimits,
      };
      
      const { error } = await settings.updateSettings(user.id, {
        notification_preferences: updatedPreferences,
      });
      
      if (error) throw error;
      
      // Update local state
      setLimits(updatedLimits);
      updateUserSettings(prevSettings => ({
        ...prevSettings,
        notification_preferences: updatedPreferences,
      }));
      
      setSuccess("Limit deleted successfully");
    } catch (err) {
      console.error("Error deleting limit:", err);
      setError("Failed to delete contribution limit");
    }
  };

  const renderLimits = () => {
    const currentYear = new Date().getFullYear();
    const currentYearLimits = limits.filter(limit => limit.contribution_year === currentYear);
    
    if (currentYearLimits.length === 0) {
      return (
        <Typography variant="body1" color="textSecondary" align="center" sx={{ my: 4 }}>
          No contribution limits set for the current year. Add one to get started.
        </Typography>
      );
    }
    
    return (
      <div className="limits-container">
        <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3}}>
          Contribution Limits for {currentYear}
        </Typography>
        
        <Grid container spacing={3}>
          {currentYearLimits.map((limit) => {
            // Calculate progress percentage
            const contribution = parseFloat(limit.contribution_amount || 0);
            const limitAmount = parseFloat(limit.limit_amount);
            const percentage = limitAmount > 0 ? Math.min(100, (contribution / limitAmount) * 100) : 0;
            
            return (
              <Grid item xs={12} md={6} key={`${limit.group_name}-${limit.contribution_year}`}>
                <Card className="limit-card">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">{limit.group_name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleOpen(limit)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteLimit(limit.group_name, limit.contribution_year)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <div>
                        <Typography variant="body2">
                          <strong>Limit:</strong> ${parseFloat(limit.limit_amount).toFixed(2)}
                        </Typography>
                        <Typography variant="body2" color={contribution > 0 ? "primary.main" : "textSecondary"}>
                          <strong>Contributed:</strong> ${contribution.toFixed(2)}
                        </Typography>
                         <Typography variant="body2" color={contribution > limitAmount ? "error.main" : "text.secondary"}>
                          <strong>Remaining:</strong> ${(limitAmount - contribution).toFixed(2)}
                        </Typography>
                      </div>
                      
                      <Box position="relative" display="inline-flex" title={`${percentage.toFixed(0)}% Utilized`}>
                        <CircularProgress 
                            variant="determinate" 
                            value={percentage} 
                            size={60} 
                            thickness={5}
                            sx={{
                                color: percentage > 100 ? 'error.main' : (percentage > 80 ? 'warning.main' : 'success.main'),
                                backgroundColor: (theme) => theme.palette.grey[theme.palette.mode === 'light' ? 200 : 700],
                                borderRadius: '50%',
                            }}
                        />
                        <Box
                          top={0}
                          left={0}
                          bottom={0}
                          right={0}
                          position="absolute"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Typography variant="caption" component="div" color="text.secondary">
                            {`${percentage.toFixed(0)}%`}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {limit.assigned_accounts && limit.assigned_accounts.length > 0 ? (
                      <div>
                        <Typography variant="subtitle2" gutterBottom>
                          Assigned Accounts:
                        </Typography>
                        <Box className="account-chips" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {limit.assigned_accounts.map(accountId => {
                            const account = accounts.find(a => a.id === accountId);
                            return account ? (
                               <Box
                                key={accountId}
                                component="span"
                                sx={{
                                    p: '4px 8px',
                                    borderRadius: '16px',
                                    backgroundColor: 'action.hover',
                                    fontSize: '0.8rem',
                                    mr: 0.5,
                                    mb: 0.5
                                }}
                                >
                                {account.name}
                                </Box>
                            ) : null;
                          })}
                        </Box>
                      </div>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        No accounts assigned
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </div>
    );
  };

  return (
    <div className="limits-settings">
      <div className="limits-header">
        <h2>Contribution Limits</h2>
        <p>Manage your contribution limits on your portfolio for specific accounts and years.</p>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<span>+</span>}
          onClick={() => handleOpen()}
        >
          Add Limit
        </Button>
      </div>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        renderLimits()
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editMode ? "Edit Contribution Limit" : "Add New Contribution Limit"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                name="group_name"
                label="Limit Name (e.g., TFSA, RRSP)"
                value={currentLimit.group_name}
                onChange={handleChange}
                fullWidth
                required
                disabled={editMode} // Group name and year together make the unique key.
                error={!currentLimit.group_name}
                helperText={!currentLimit.group_name ? "Limit name is required" : ""}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                name="contribution_year"
                label="Contribution Year"
                type="number"
                value={currentLimit.contribution_year}
                onChange={handleChange}
                fullWidth
                required
                inputProps={{ min: 2000, max: 2100 }}
                disabled={editMode}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="limit_amount"
                label="Limit Amount ($)"
                value={currentLimit.limit_amount}
                onChange={handleChange}
                type="number"
                fullWidth
                required
                inputProps={{ min: 0.01, step: "0.01" }}
                error={!currentLimit.limit_amount || parseFloat(currentLimit.limit_amount) <= 0}
                helperText={
                    !currentLimit.limit_amount ? "Limit amount is required" :
                    parseFloat(currentLimit.limit_amount) <= 0 ? "Must be greater than 0" : ""
                }
              />
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" gutterBottom>
                Assign Accounts to This Limit
              </Typography>
            </Grid>
            
            {accounts.length === 0 ? (
              <Grid item xs={12}>
                <Typography variant="body2" color="textSecondary">
                  No accounts available. Please add accounts in Portfolio Settings first.
                </Typography>
              </Grid>
            ) : (
              <>
                <Grid item xs={12} sm={9}>
                  <FormControl fullWidth>
                    <InputLabel>Select Account to Assign</InputLabel>
                    <Select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      label="Select Account to Assign"
                    >
                      <MenuItem value="">
                        <em>-- Select an Account --</em>
                      </MenuItem>
                      {accounts
                        .filter(account => !currentLimit.assigned_accounts.includes(account.id))
                        .map(account => (
                          <MenuItem key={account.id} value={account.id}>
                            {account.name} ({account.credentials?.group || 'N/A'})
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={3}>
                  <Button
                    variant="outlined"
                    onClick={handleAddAssignedAccount}
                    fullWidth
                    sx={{ height: '56px' }} // Match TextField height
                    disabled={!selectedAccountId}
                  >
                    Assign Account
                  </Button>
                </Grid>
                
                {currentLimit.assigned_accounts.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom sx={{mt:1}}>
                      Assigned Accounts:
                    </Typography>
                    <Box 
                        className="assigned-accounts-list" 
                        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
                    >
                      {currentLimit.assigned_accounts.map(accountId => {
                        const account = accounts.find(a => a.id === accountId);
                        return account ? (
                          <Box 
                            key={accountId} 
                            className="assigned-account-item"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                p: '4px 8px',
                                borderRadius: '16px',
                                backgroundColor: 'action.hover',
                                gap: 0.5
                            }}
                            >
                            <span>{account.name}</span>
                            <IconButton 
                              size="small" 
                              onClick={() => handleRemoveAssignedAccount(accountId)}
                              aria-label={`Remove ${account.name}`}
                            >
                              <DeleteIcon fontSize="inherit" />
                            </IconButton>
                          </Box>
                        ) : null;
                      })}
                    </Box>
                  </Grid>
                )}
              </>
            )}
            
            {editMode && (
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Track Contributions
                </Typography>
                <TextField
                  name="contribution_amount"
                  label="Current Total Contribution ($) for this Limit"
                  type="number"
                  value={currentLimit.contribution_amount || 0}
                  onChange={handleChange}
                  fullWidth
                  inputProps={{ min: 0, step: "0.01" }}
                   error={currentLimit.contribution_amount && parseFloat(currentLimit.contribution_amount) < 0}
                  helperText={
                      currentLimit.contribution_amount && parseFloat(currentLimit.contribution_amount) < 0 ? "Cannot be negative" : ""
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={saveLimit} 
            variant="contained" 
            color="primary"
            disabled={
                saving || 
                !currentLimit.group_name || 
                !currentLimit.limit_amount || 
                parseFloat(currentLimit.limit_amount) <= 0 ||
                (currentLimit.contribution_amount && parseFloat(currentLimit.contribution_amount) < 0)
            }
          >
            {saving ? <CircularProgress size={24}/> : editMode ? "Update Limit" : "Add Limit"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default LimitsSettings;