import React, { useState, useEffect, useCallback } from "react";
import "../components/PortfolioSettings.css";
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Grid,
  IconButton,
  CircularProgress,
  Card,
  CardContent,
  Typography,
  Divider,
} from "@mui/material";
import { Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { brokers } from "../lib/supabase";

const accountGroups = [
  "Retirement",
  "RRSP",
  "TFSA",
  "Personal",
  "Investment",
  "Savings",
  "Joint",
  "Other",
];

const accountTypes = [
  "Cash",
  "Securities",
  "Crypto",
  "Real Estate",
  "Precious Metals",
  "Fixed Income",
  "Savings",
  "Checking",
  "Other",
];

function PortfolioSettings({ setError, setSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentAccount, setCurrentAccount] = useState({
    name: "",
    group: accountGroups[0],
    type: accountTypes[0],
    description: "",
  });

  const fetchAccounts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await brokers.getBrokers(user.id);
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setError("Failed to load accounts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, setError]);

  useEffect(() => {
    fetchAccounts();
  }, [user, fetchAccounts]);

  const handleOpen = (account = null) => {
    if (account) {
      setCurrentAccount(account);
      setEditMode(true);
    } else {
      setCurrentAccount({
        name: "",
        group: accountGroups[0],
        type: accountTypes[0],
        description: "",
      });
      setEditMode(false);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    setCurrentAccount({
      ...currentAccount,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = async () => {
    if (!currentAccount.name) {
      setError("Account name is required");
      return;
    }

    try {
      if (editMode) {
        const { error } = await brokers.updateBroker(
          currentAccount.id,
          {
            name: currentAccount.name,
            description: currentAccount.description,
            // Store group and type in a structured way
            credentials: {
              group: currentAccount.group,
              type: currentAccount.type,
            },
          }
        );
        if (error) throw error;
        setSuccess("Account updated successfully");
      } else {
        const { error } = await brokers.addBroker({
          user_id: user.id,
          name: currentAccount.name,
          description: currentAccount.description,
          credentials: {
            group: currentAccount.group,
            type: currentAccount.type,
          },
        });
        if (error) throw error;
        setSuccess("Account added successfully");
      }
      fetchAccounts();
      handleClose();
    } catch (err) {
      console.error("Error saving account:", err);
      setError(editMode ? "Failed to update account" : "Failed to add account");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this account?")) return;

    try {
      const { error } = await brokers.deleteBroker(id);
      if (error) throw error;
      setAccounts(accounts.filter(account => account.id !== id));
      setSuccess("Account deleted successfully");
    } catch (err) {
      console.error("Error deleting account:", err);
      setError("Failed to delete account");
    }
  };

  return (
    <div className="portfolio-settings">
      <div className="portfolio-header">
        <h2>Your Accounts</h2>
        <p>Manage your investment and saving accounts.</p>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleOpen()}
          startIcon={<span>+</span>}
        >
          Add Account
        </Button>
      </div>

      {loading ? (
        <div className="loading-container">
          <CircularProgress />
        </div>
      ) : accounts.length === 0 ? (
        <div className="no-accounts">
          <Typography variant="body1" color="textSecondary" align="center" sx={{ my: 4 }}>
            No accounts added yet. Add your first account to get started.
          </Typography>
        </div>
      ) : (
        <Grid container spacing={2} className="account-grid">
          {accounts.map((account) => (
            <Grid item xs={12} sm={6} md={4} key={account.id}>
              <Card className="account-card">
                <CardContent>
                  <div className="account-header">
                    <Typography variant="h6">{account.name}</Typography>
                    <div className="account-actions">
                      <IconButton size="small" onClick={() => handleOpen(
                        {
                          ...account,
                          group: account.credentials?.group || accountGroups[0],
                          type: account.credentials?.type || accountTypes[0],
                        }
                      )}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(account.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="body2" color="textSecondary">
                    <strong>Group:</strong> {account.credentials?.group || 'None'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    <strong>Type:</strong> {account.credentials?.type || 'None'}
                  </Typography>

                  {account.description && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {account.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? "Edit Account" : "Add New Account"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Account Name"
                value={currentAccount.name}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Account Group</InputLabel>
                <Select
                  name="group"
                  value={currentAccount.group}
                  onChange={handleChange}
                  label="Account Group"
                >
                  {accountGroups.map((group) => (
                    <MenuItem key={group} value={group}>
                      {group}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  name="type"
                  value={currentAccount.type}
                  onChange={handleChange}
                  label="Account Type"
                >
                  {accountTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description (Optional)"
                value={currentAccount.description || ""}
                onChange={handleChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" color="primary">
            {editMode ? "Update" : "Add"} Account
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default PortfolioSettings;