import React, { useState, useEffect, useCallback } from 'react';
import {
  Container, Typography, Box, Tabs, Tab, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Button, IconButton,
  Switch, FormControlLabel, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, MenuItem, Select, InputLabel, FormControl,
  CircularProgress, Snackbar, Alert, Card, CardContent, TextField
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  // Block as BlockIcon, // Removed as handleDeactivateUser is removed
} from '@mui/icons-material';
import { supabase } from '../lib/supabase';

const initialConfigurations = {
  default_currency: 'AUD',
  enable_cgt: true,
  free_user_upload_limit: 100,
  premium_user_upload_limit: 1000,
  default_theme: 'light',
};

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configurations, setConfigurations] = useState(initialConfigurations);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [deleteUserDialog, setDeleteUserDialog] = useState({ open: false, userId: null, email: '' });
  // const [editUser, setEditUser] = useState(null); // REMOVED

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const showNotification = useCallback((message, severity = 'info') => {
    setNotification({ open: true, message, severity });
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, avatar_url, created_at, is_admin, account_type')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification(`Error loading users: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      if (data) {
        setConfigurations(data);
      } else {
        showNotification('No system configurations found. Using defaults.', 'warning');
        setConfigurations(initialConfigurations); // Ensure defaults are set if nothing found
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
      showNotification(`Error loading configurations: ${error.message}`, 'error');
      setConfigurations(initialConfigurations);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);


  useEffect(() => {
    if (activeTab === 0) {
      loadUsers();
    } else if (activeTab === 1) {
      loadConfigurations();
    }
  }, [activeTab, loadUsers, loadConfigurations]);


  const handleUpdateUserAdminStatus = async (userId, isAdminStatus) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-admin-status', {
        body: { userIdToUpdate: userId, isAdmin: isAdminStatus },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(users.map(user => user.id === userId ? { ...user, is_admin: isAdminStatus } : user));
      showNotification(`User admin status updated successfully`, 'success');
    } catch (error) {
      console.error('Error updating user admin status:', error);
      showNotification(`Error: ${error.message}`, 'error');
      loadUsers();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccountType = async (userId, newType) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: newType })
        .eq('id', userId);
      if (error) throw error;
      setUsers(users.map(user => user.id === userId ? { ...user, account_type: newType } : user));
      showNotification(`Account type updated to ${newType}`, 'success');
    } catch (error) {
      console.error('Error updating account type:', error);
      showNotification(`Error: ${error.message}`, 'error');
      loadUsers();
    } finally {
      setLoading(false);
    }
  };

  // const handleDeactivateUser = async (userId) => { // REMOVED
  //   setLoading(true);
  //   try {
  //     const { data, error } = await supabase.functions.invoke('set-user-active-status', {
  //       body: { userIdToUpdate: userId, isActive: false },
  //     });
  //     if (error) throw error;
  //     if (data?.error) throw new Error(data.error);
  //     showNotification(`User status updated successfully`, 'success');
  //     loadUsers();
  //   } catch (error) {
  //     console.error('Error deactivating user:', error);
  //     showNotification(`Error: ${error.message}`, 'error');
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  
  const handleOpenDeleteDialog = (userId, email) => {
    setDeleteUserDialog({ open: true, userId, email });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteUserDialog({ open: false, userId: null, email: '' });
  };

  const handleDeleteUser = async () => {
    if (!deleteUserDialog.userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-admin', {
        body: { userIdToDelete: deleteUserDialog.userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(users.filter(user => user.id !== deleteUserDialog.userId));
      showNotification(`User ${deleteUserDialog.email} deleted successfully`, 'success');
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification(`Error deleting user: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfigurations = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert(configurations, { 
            onConflict: 'id', // Assuming 'id' is the primary key of your system_settings table
                               // If you only have one row and want to always update it,
                               // you might need to know its specific ID or use a different upsert strategy.
                               // If 'id' is auto-generated and you want to update the first found row (if it exists)
                               // or insert if not, this might need adjustment based on table PK.
                               // For a single config row, often a fixed ID (e.g., 'main_config') is used.
        });
      if (error) throw error;
      showNotification('System settings updated successfully', 'success');
    } catch (error) {
      console.error('Error saving configurations:', error);
      showNotification(`Error saving configurations: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Admin Dashboard
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="admin dashboard tabs">
          <Tab label="User Management" id="admin-tab-0" aria-controls="admin-tabpanel-0" />
          <Tab label="System Configuration" id="admin-tab-1" aria-controls="admin-tabpanel-1" />
        </Tabs>
      </Box>
      
      <Box role="tabpanel" hidden={activeTab !== 0} id="admin-tabpanel-0" aria-labelledby="admin-tab-0">
        {activeTab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" component="h2">User Management</Typography>
              <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadUsers} disabled={loading}>
                Refresh Users
              </Button>
            </Box>
            
            {loading && users.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : (
              <TableContainer component={Paper}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Account Type</TableCell>
                      <TableCell>Admin Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>{user.first_name || ''} {user.last_name || ''}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            value={user.account_type || 'free'}
                            size="small"
                            onChange={(e) => handleUpdateAccountType(user.id, e.target.value)}
                            disabled={loading} sx={{ minWidth: 100 }}
                          >
                            <MenuItem value="free">Free</MenuItem>
                            <MenuItem value="premium">Premium</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <FormControlLabel
                            control={
                              <Switch 
                                checked={user.is_admin === true}
                                onChange={(e) => handleUpdateUserAdminStatus(user.id, e.target.checked)}
                                disabled={loading}
                              />
                            }
                            label={user.is_admin ? "Admin" : "User"}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton title="Delete User" color="error" onClick={() => handleOpenDeleteDialog(user.id, user.email)} disabled={loading}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && !loading && (
                      <TableRow><TableCell colSpan={5} align="center">No users found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Box>
      
      <Box role="tabpanel" hidden={activeTab !== 1} id="admin-tabpanel-1" aria-labelledby="admin-tab-1">
        {activeTab === 1 && (
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>System Configuration</Typography>
            {/* Corrected: Use configurations from state, not hardcoded keys like configurations.defaultCurrency */}
            {loading && !configurations.default_currency ? ( // Check a key that should exist from DB or initial state
                 <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
            ) : (
            <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Currency & Financial Settings</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <FormControl fullWidth>
                    <InputLabel id="default-currency-label">Default Currency</InputLabel>
                    <Select
                      labelId="default-currency-label" value={configurations.default_currency || 'AUD'} label="Default Currency"
                      onChange={(e) => setConfigurations({...configurations, default_currency: e.target.value})}
                    >
                      <MenuItem value="USD">US Dollar (USD)</MenuItem>
                      <MenuItem value="AUD">Australian Dollar (AUD)</MenuItem>
                      <MenuItem value="EUR">Euro (EUR)</MenuItem>
                      <MenuItem value="GBP">British Pound (GBP)</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel control={<Switch checked={configurations.enable_cgt || false} onChange={(e) => setConfigurations({...configurations, enable_cgt: e.target.checked})} />}
                    label="Enable Capital Gains Tax (CGT) Calculation" />
                </Box>
              </CardContent>
            </Card>
            
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>User Limits</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <TextField label="Free User Upload Limit" type="number" value={configurations.free_user_upload_limit || 0}
                    onChange={(e) => setConfigurations({...configurations, free_user_upload_limit: parseInt(e.target.value) || 0})} fullWidth helperText="Max transactions for free users" />
                  <TextField label="Premium User Upload Limit" type="number" value={configurations.premium_user_upload_limit || 0}
                    onChange={(e) => setConfigurations({...configurations, premium_user_upload_limit: parseInt(e.target.value) || 0})} fullWidth helperText="Max transactions for premium users" />
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Display Settings</Typography>
                 <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  <FormControl fullWidth>
                    <InputLabel id="default-theme-label">Default Theme for New Users</InputLabel>
                    <Select labelId="default-theme-label" value={configurations.default_theme || 'light'} label="Default Theme for New Users"
                      onChange={(e) => setConfigurations({...configurations, default_theme: e.target.value})} >
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </CardContent>
            </Card>
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" color="primary" onClick={handleSaveConfigurations} disabled={loading}>Save Configuration</Button>
            </Box>
            </>
            )}
          </Box>
        )}
      </Box>
      
      <Dialog open={deleteUserDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete User Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete the user <strong>{deleteUserDialog.email}</strong>? 
            This will delete their authentication record and all associated data based on your database's cascade rules. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : "Delete User"}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }} variant="filled">
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default AdminDashboard;