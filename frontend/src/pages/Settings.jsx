import React, { useState, useEffect } from "react";
import "../components/Settings.css"; // Or './SettingsPage.css'
import PortfolioSettings from "./PortfolioSettings";
import LimitsSettings from "./LimitsSettings";
import GoalsSettings from "./GoalsSettings";
import DataExportSettings from "./DataExportSettings";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase, settings } from "../lib/supabase"; // Ensure supabase client is exported here
import { TextField, MenuItem, Button, Alert, CircularProgress, Switch, FormControlLabel } from "@mui/material";
import { useLocation } from "react-router-dom";
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

function SettingsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("General");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userSettings, setUserSettings] = useState({
    default_currency: "USD",
    theme: "dark",
    notification_preferences: {},
    entity_type: "individual",
    parcel_matching: "fifo",
    cgt_method: "auto",
    prior_year_loss: 0,
  });
  const [localProfile, setLocalProfile] = useState(null);
  const [currencies, _setCurrencies] = useState([ // Corrected: Renamed setCurrencies
    { code: "USD", name: "United States Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "INR", name: "Indian Rupee" },
  ]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [newExchangeRate, setNewExchangeRate] = useState({ currency: "", rate: "" });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { user, profile, updateProfile } = useAuth();
  const { mode, setThemeMode } = useTheme();

  useEffect(() => {
    if (profile) {
      setLocalProfile(profile);
    }
  }, [profile]);

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error: fetchError } = await settings.getSettings(user.id);
        if (fetchError) throw fetchError;
        
        if (data) {
          setUserSettings(data);
          if (data.notification_preferences?.exchange_rates) {
            setExchangeRates(data.notification_preferences.exchange_rates || []);
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        setError("Failed to load settings. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  useEffect(() => {
    setUserSettings(prev => ({
      ...prev,
      theme: mode
    }));
  }, [mode]);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSuccess(null);
    setError(null);
  };

  const handleCurrencyChange = (e) => {
    setUserSettings({
      ...userSettings,
      default_currency: e.target.value
    });
  };

  const handleAddExchangeRate = () => {
    if (!newExchangeRate.currency || !newExchangeRate.rate) {
      setError("Please select a currency and enter a rate");
      return;
    }
    if (isNaN(parseFloat(newExchangeRate.rate)) || parseFloat(newExchangeRate.rate) <= 0) {
      setError("Please enter a valid positive number for the rate");
      return;
    }
    if (exchangeRates.some(rate => rate.currency === newExchangeRate.currency)) {
      setError("This currency already has an exchange rate");
      return;
    }
    setExchangeRates([...exchangeRates, newExchangeRate]);
    setNewExchangeRate({ currency: "", rate: "" });
    setError(null);
  };

  const handleRemoveExchangeRate = (currency) => {
    setExchangeRates(exchangeRates.filter(rate => rate.currency !== currency));
  };

  const saveGeneralSettings = async () => {
    if (!user) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const updatedSettings = {
        ...userSettings,
        notification_preferences: {
          ...userSettings.notification_preferences,
          exchange_rates: exchangeRates
        }
      };
      
      const { error: saveError } = await settings.updateSettings(user.id, updatedSettings);
      if (saveError) throw saveError;
      
      setUserSettings(updatedSettings);
      setSuccess("Settings saved successfully");
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (theme) => {
    setUserSettings({
      ...userSettings,
      theme
    });
    setThemeMode(theme);
  };

  const handleThemeToggle = (event) => {
    const newTheme = event.target.checked ? 'dark' : 'light';
    handleThemeChange(newTheme);
  };

  const handletaxettingChange = (field, value) => {
    setUserSettings(prev => ({ ...prev, [field]: value }));
  };

  const updateUserSettings = (newSettings) => {
    setUserSettings({
      ...userSettings,
      ...newSettings
    });
  };

  const handleProfileUpdate = async () => {
    if (!user || !localProfile) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    let displayNameError = null;

    try {
      await updateProfile({
        first_name: localProfile.first_name,
        last_name: localProfile.last_name,
      });

      const firstName = localProfile.first_name || "";
      const lastName = localProfile.last_name || "";
      const newDisplayName = `${firstName} ${lastName}`.trim();

      if (newDisplayName) {
        const { error: updateUserAuthError } = await supabase.auth.updateUser({
          data: { display_name: newDisplayName },
        });

        if (updateUserAuthError) {
          displayNameError = updateUserAuthError; // Store it to check later
          throw updateUserAuthError;
        }
        // user object in AuthContext should update via onAuthStateChange
      }
      
      setSuccess("Profile updated successfully!");

    } catch (err) {
      console.error("Error updating profile:", err);
      if (err === displayNameError) { // Check if the caught error is specifically the displayName update error
        setError("Profile details updated, but failed to update display name. Please try again.");
      } else {
        setError("Failed to update profile details. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Construct Supabase project URL safely
  const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUserManagementUrl = supabaseProjectId
    ? `https://app.supabase.com/project/${supabaseProjectId}/auth/users`
    : "#"; // Fallback URL or disable link if ID is not set

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subheader">
          Manage your general portfolio settings & preferences.
        </p>
      </div>

      {loading && (
        <div className="loading-container">
          <CircularProgress />
        </div>
      )}

      {!loading && (
        <div className="settings-content">
          <div className="sidebar">
            <ul>
              <li
                className={activeTab === "General" ? "active" : ""}
                onClick={() => handleTabClick("General")}
              >
                General
              </li>
              <li
                className={activeTab === "Accounts" ? "active" : ""}
                onClick={() => handleTabClick("Accounts")}
              >
                Accounts
              </li>
              <li
                className={activeTab === "Limits" ? "active" : ""}
                onClick={() => handleTabClick("Limits")}
              >
                Limits
              </li>
              <li
                className={activeTab === "Goals" ? "active" : ""}
                onClick={() => handleTabClick("Goals")}
              >
                Goals
              </li>
              <li
                className={activeTab === "Appearance" ? "active" : ""}
                onClick={() => handleTabClick("Appearance")}
              >
                Appearance
              </li>
              <li
                className={activeTab === "Data Export" ? "active" : ""}
                onClick={() => handleTabClick("Data Export")}
              >
                Data Export
              </li>
              <li
                className={activeTab === "Your Profile" ? "active" : ""}
                onClick={() => handleTabClick("Your Profile")}
              >
                Your Profile
              </li>
              <li
                className={activeTab === "Tax Settings" ? "active" : ""}
                onClick={() => handleTabClick("Tax Settings")}
              >
                Tax Settings
              </li>
            </ul>
          </div>

          <div className="main-content">
            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {activeTab === "General" && (
              <div className="general-settings">
                <div className="base-currency-card">
                  <h3>Base Currency</h3>
                  <p>Select your portfolio base currency.</p>
                  <div className="currency-selector">
                    <TextField
                      select
                      label="Currency"
                      value={userSettings.default_currency}
                      onChange={handleCurrencyChange}
                      fullWidth
                      variant="outlined"
                      margin="normal"
                    >
                      {currencies.map((currency) => (
                        <MenuItem key={currency.code} value={currency.code}>
                          {currency.name} ({currency.code})
                        </MenuItem>
                      ))}
                    </TextField>
                  </div>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={saveGeneralSettings}
                    disabled={saving}
                  >
                    {saving ? <CircularProgress size={24} /> : "Save"}
                  </Button>
                </div>

                <div className="exchange-rates-card">
                  <h3>Exchange Rates</h3>
                  <p>Manage exchange rates for currencies in your portfolio.</p>
                  
                  {exchangeRates.length === 0 ? (
                    <p className="no-rates">No exchange rates defined!</p>
                  ) : (
                    <div className="exchange-rates-list">
                      {exchangeRates.map((rate) => (
                        <div key={rate.currency} className="exchange-rate-item">
                          <div>
                            <strong>{rate.currency}</strong>: {rate.rate} per {userSettings.default_currency}
                          </div>
                          <Button 
                            size="small" 
                            color="error" 
                            onClick={() => handleRemoveExchangeRate(rate.currency)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="add-exchange-rate">
                    <TextField
                      select
                      label="Currency"
                      value={newExchangeRate.currency}
                      onChange={(e) => setNewExchangeRate({...newExchangeRate, currency: e.target.value})}
                      sx={{ mr: 2, minWidth: 150 }}
                    >
                      {currencies
                        .filter(c => c.code !== userSettings.default_currency)
                        .filter(c => !exchangeRates.some(r => r.currency === c.code))
                        .map((currency) => (
                          <MenuItem key={currency.code} value={currency.code}>
                            {currency.name} ({currency.code})
                          </MenuItem>
                        ))}
                    </TextField>
                    
                    <TextField
                      label="Rate"
                      type="number"
                      value={newExchangeRate.rate}
                      onChange={(e) => setNewExchangeRate({...newExchangeRate, rate: e.target.value})}
                      sx={{ mr: 2, minWidth: 100 }}
                      inputProps={{ min: 0, step: "0.0001" }}
                    />
                    
                    <Button 
                      variant="outlined" 
                      onClick={handleAddExchangeRate}
                    >
                      Add Rate
                    </Button>
                  </div>
                  
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={saveGeneralSettings}
                    disabled={saving}
                    sx={{ mt: 2 }}
                  >
                    {saving ? <CircularProgress size={24} /> : "Save Exchange Rates"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "Accounts" && (
              <PortfolioSettings 
                userSettings={userSettings} 
                updateUserSettings={updateUserSettings} 
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
            
            {activeTab === "Limits" && (
              <LimitsSettings 
                userSettings={userSettings} 
                updateUserSettings={updateUserSettings}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}

            {activeTab === "Goals" && (
              <GoalsSettings 
                userSettings={userSettings} 
                updateUserSettings={updateUserSettings}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
            
            {activeTab === "Appearance" && (
              <div className="appearance-settings">
                <h3>Theme Settings</h3>
                <p>Choose your preferred application theme.</p>
                
                <div className="theme-toggle-option">
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={mode === 'dark'}
                        onChange={handleThemeToggle}
                        color="primary"
                      />
                    }
                    label={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {mode === 'dark' ? (
                          <>
                            <Brightness4Icon sx={{ mr: 1 }} />
                            Dark Mode
                          </>
                        ) : (
                          <>
                            <Brightness7Icon sx={{ mr: 1 }} />
                            Light Mode
                          </>
                        )}
                      </div>
                    }
                  />
                </div>
                
                <div className="theme-options">
                  <div 
                    className={`theme-option ${mode === 'light' ? 'selected' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    <div className="theme-preview light-theme"></div>
                    <p>Light Mode</p>
                  </div>
                  
                  <div 
                    className={`theme-option ${mode === 'dark' ? 'selected' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    <div className="theme-preview dark-theme"></div>
                    <p>Dark Mode</p>
                  </div>
                </div>
                
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={saveGeneralSettings}
                  disabled={saving}
                  sx={{ mt: 2 }}
                >
                  {saving ? <CircularProgress size={24} /> : "Save Theme Preferences"}
                </Button>
              </div>
            )}
            
            {activeTab === "Data Export" && (
              <DataExportSettings 
                userSettings={userSettings}
                setError={setError}
                setSuccess={setSuccess}
              />
            )}
            
            {activeTab === "Your Profile" && (
              <div className="profile-settings">
                <h3>Your Profile</h3>
                <p>Manage your account information and preferences.</p>

                <div className="user-info">
                  <p><strong>Email:</strong> {user?.email}</p>
                  <p><strong>Display Name:</strong> {user?.user_metadata?.display_name || "Not set"}</p>

                  <div className="profile-edit-form">
                    <h4>Edit Profile</h4>
                    <TextField
                      label="First Name"
                      value={localProfile?.first_name || ""}
                      onChange={(e) => setLocalProfile({...localProfile, first_name: e.target.value})}
                      fullWidth
                      variant="outlined"
                      margin="normal"
                      disabled={saving}
                    />
                    <TextField
                      label="Last Name"
                      value={localProfile?.last_name || ""}
                      onChange={(e) => setLocalProfile({...localProfile, last_name: e.target.value})}
                      fullWidth
                      variant="outlined"
                      margin="normal"
                      disabled={saving}
                    />
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleProfileUpdate}
                      disabled={saving || !localProfile}
                    >
                      {saving ? <CircularProgress size={24} /> : "Update Profile"}
                    </Button>
                  </div>

                  <div className="account-management">
                    <h4>Account Management</h4>
                    <p>Manage your account details, password, and security settings.</p>
                    <Button
                      variant="outlined"
                      color="primary"
                      href={supabaseUserManagementUrl} // Use the constructed URL
                      target="_blank"
                      rel="noopener noreferrer"
                      disabled={!supabaseProjectId} // Optionally disable if ID is not available
                    >
                      Manage Account on Supabase
                    </Button>
                    {!supabaseProjectId && (
                        <p style={{color: 'red', fontSize: '0.8em', marginTop: '4px'}}>
                            Supabase project ID not configured. Link disabled.
                        </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Tax Settings" && (
              <div className="tax-settings">
                <h3>Tax Settings</h3>
                <p>
                  These settings control how the tax calculation engine computes your
                  capital gains tax. Changes take effect on the next portfolio refresh.
                </p>

                <TextField
                  select
                  label="Entity Type"
                  value={userSettings.entity_type || "individual"}
                  onChange={(e) => handletaxettingChange("entity_type", e.target.value)}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  helperText="Your legal tax entity — affects the CGT discount rate."
                >
                  <MenuItem value="individual">Individual (50% CGT discount)</MenuItem>
                  <MenuItem value="trust">Trust (50% CGT discount)</MenuItem>
                  <MenuItem value="smsf">SMSF (33.33% CGT discount)</MenuItem>
                  <MenuItem value="company">Company (no CGT discount)</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Parcel Matching Method"
                  value={userSettings.parcel_matching || "fifo"}
                  onChange={(e) => handletaxettingChange("parcel_matching", e.target.value)}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  helperText="How sell orders are matched to buy parcels for CGT."
                >
                  <MenuItem value="fifo">FIFO — First In, First Out</MenuItem>
                  <MenuItem value="lifo">LIFO — Last In, First Out</MenuItem>
                  <MenuItem value="minimise_tax">Minimise Tax (best CGT outcome)</MenuItem>
                </TextField>

                <TextField
                  select
                  label="CGT Calculation Method"
                  value={userSettings.cgt_method || "auto"}
                  onChange={(e) => handletaxettingChange("cgt_method", e.target.value)}
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  helperText="Auto chooses the best method (discount vs indexation) per parcel."
                >
                  <MenuItem value="auto">Auto (recommended)</MenuItem>
                  <MenuItem value="discount">Discount Method always</MenuItem>
                  <MenuItem value="indexation">Indexation Method always</MenuItem>
                  <MenuItem value="other">Other Cost Method</MenuItem>
                </TextField>

                <TextField
                  label="Prior Year Capital Loss Carried Forward ($)"
                  type="number"
                  value={userSettings.prior_year_loss ?? 0}
                  onChange={(e) =>
                    handletaxettingChange("prior_year_loss", parseFloat(e.target.value) || 0)
                  }
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  inputProps={{ min: 0, step: "0.01" }}
                  helperText="Enter any capital loss carried forward from a previous financial year."
                />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={saveGeneralSettings}
                  disabled={saving}
                  sx={{ mt: 2 }}
                >
                  {saving ? <CircularProgress size={24} /> : "Save Tax Settings"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;