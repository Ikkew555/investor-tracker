import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  Typography,
  Box,
  Card,
  CardContent,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from "@mui/material";
import { Edit as EditIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { settings } from "../lib/supabase";

const goalTypes = [
  "Retirement",
  "Education",
  "House",
  "Car",
  "Travel",
  "Wedding",
  "Emergency Fund",
  "Other",
];

function GoalsSettings({ userSettings, updateUserSettings, setError, setSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentGoal, setCurrentGoal] = useState({
    id: "",
    name: "",
    description: "",
    goal_type: goalTypes[0],
    target_amount: "",
    current_amount: 0,
    target_date: "",
  });

  const fetchGoals = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await settings.getSettings(user.id);
      if (error) throw error;

      if (data?.notification_preferences?.investment_goals) {
        setGoals(data.notification_preferences.investment_goals);
      } else {
        setGoals([]); // Ensure goals is an array even if not present
      }
    } catch (err) {
      console.error("Error fetching goals:", err);
      setError("Failed to load goals. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, setError]); // Added setError as a dependency

  useEffect(() => {
    fetchGoals();
  }, [user, fetchGoals]); // Added fetchGoals to dependency array

  const handleOpen = (goal = null) => {
    if (goal) {
      setCurrentGoal(goal);
      setEditMode(true);
    } else {
      setCurrentGoal({
        id: Date.now().toString(), // Simple unique ID
        name: "",
        description: "",
        goal_type: goalTypes[0],
        target_amount: "",
        current_amount: 0,
        target_date: "",
      });
      setEditMode(false);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if ((name === "target_amount" || name === "current_amount") && value && isNaN(parseFloat(value))) {
      return; // Allow only numbers for amounts
    }
    setCurrentGoal({
      ...currentGoal,
      [name]: value,
    });
  };

  const saveGoal = async () => {
    if (!currentGoal.name || !currentGoal.target_amount) {
      setError("Goal name and target amount are required");
      return;
    }
    if (parseFloat(currentGoal.target_amount) <= 0) {
        setError("Target amount must be greater than zero.");
        return;
    }
    if (currentGoal.current_amount && parseFloat(currentGoal.current_amount) < 0) {
        setError("Current amount cannot be negative.");
        return;
    }


    setSaving(true);
    try {
      let updatedGoals = [...goals];
      
      if (editMode) {
        const index = goals.findIndex(g => g.id === currentGoal.id);
        if (index >= 0) {
          updatedGoals[index] = currentGoal;
        } else {
          // This case should ideally not happen if editMode implies existing goal
          // but as a fallback, add it.
          updatedGoals.push(currentGoal);
        }
      } else {
        updatedGoals.push(currentGoal);
      }
      
      // Ensure userSettings and notification_preferences exist
      const basePreferences = userSettings?.notification_preferences || {};

      // Update in Supabase
      const updatedPreferences = {
        ...basePreferences,
        investment_goals: updatedGoals,
      };
      
      const { error } = await settings.updateSettings(user.id, {
        notification_preferences: updatedPreferences,
      });
      
      if (error) throw error;
      
      // Update local state
      setGoals(updatedGoals);
      updateUserSettings((prevSettings) => ({ // Use functional update for userSettings
        ...prevSettings,
        notification_preferences: updatedPreferences,
      }));
      
      setSuccess(editMode ? "Goal updated successfully" : "Goal added successfully");
      handleClose();
    } catch (err) {
      console.error("Error saving goal:", err);
      setError("Failed to save goal");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    
    try {
      const updatedGoals = goals.filter(g => g.id !== id);
      
      // Ensure userSettings and notification_preferences exist
      const basePreferences = userSettings?.notification_preferences || {};

      // Update in Supabase
      const updatedPreferences = {
        ...basePreferences,
        investment_goals: updatedGoals,
      };
      
      const { error } = await settings.updateSettings(user.id, {
        notification_preferences: updatedPreferences,
      });
      
      if (error) throw error;
      
      // Update local state
      setGoals(updatedGoals);
      updateUserSettings((prevSettings) => ({ // Use functional update
        ...prevSettings,
        notification_preferences: updatedPreferences,
      }));
      
      setSuccess("Goal deleted successfully");
    } catch (err) {
      console.error("Error deleting goal:", err);
      setError("Failed to delete goal");
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage < 25) return "error";
    if (percentage < 75) return "warning";
    return "success";
  };

  return (
    <div className="goals-settings">
      <div className="goals-header">
        <h2>Investment & Savings Goals</h2>
        <p>Track your financial goals and monitor your progress.</p>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<span>+</span>}
          onClick={() => handleOpen()}
        >
          Add Goal
        </Button>
      </div>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : goals.length === 0 ? (
        <Typography variant="body1" color="textSecondary" align="center" sx={{ my: 4 }}>
          No goals set yet. Add your first financial goal to get started.
        </Typography>
      ) : (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {goals.map((goal) => {
            // Calculate progress percentage
            const current = parseFloat(goal.current_amount || 0);
            const target = parseFloat(goal.target_amount);
            const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            
            // Calculate date information
            const hasTargetDate = !!goal.target_date;
            const targetDate = hasTargetDate ? new Date(goal.target_date) : null;
            const daysLeft = hasTargetDate && targetDate instanceof Date && !isNaN(targetDate)
                             ? Math.ceil((targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) 
                             : null;
            
            return (
              <Grid item xs={12} md={6} key={goal.id}>
                <Card className="goal-card">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">{goal.name}</Typography>
                      <Box>
                        <IconButton size="small" onClick={() => handleOpen(goal)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteGoal(goal.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    
                    <Typography variant="caption" color="textSecondary">
                      {goal.goal_type}
                    </Typography>
                    
                    {goal.description && (
                      <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
                        {goal.description}
                      </Typography>
                    )}
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Box sx={{ mb: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          <strong>Progress:</strong> ${current.toFixed(2)} of ${target > 0 ? target.toFixed(2) : '0.00'}
                        </Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {percentage.toFixed(0)}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={percentage} 
                        color={getProgressColor(percentage)}
                        sx={{ 
                          height: 8, 
                          borderRadius: 5, 
                          mt: 1,
                          mb: 1,
                        }}
                      />
                    </Box>
                    
                    {hasTargetDate && targetDate instanceof Date && !isNaN(targetDate) && daysLeft !== null && (
                      <Typography variant="body2" color={daysLeft < 0 ? "error.main" : "textSecondary"}>
                        <strong>Target Date:</strong> {targetDate.toLocaleDateString()} 
                        {daysLeft < 0 ? ` (${Math.abs(daysLeft)} days overdue)` : ` (${daysLeft} days left)`}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? "Edit Goal" : "Add New Goal"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                name="name"
                label="Goal Name"
                value={currentGoal.name}
                onChange={handleChange}
                fullWidth
                required
                error={!currentGoal.name}
                helperText={!currentGoal.name ? "Goal name is required" : ""}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Goal Type</InputLabel>
                <Select
                  name="goal_type"
                  value={currentGoal.goal_type}
                  onChange={handleChange}
                  label="Goal Type"
                >
                  {goalTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                name="target_amount"
                label="Target Amount ($)"
                value={currentGoal.target_amount}
                onChange={handleChange}
                fullWidth
                required
                inputProps={{ min: 0.01, step: "0.01" }}
                type="number"
                error={!currentGoal.target_amount || parseFloat(currentGoal.target_amount) <= 0}
                helperText={
                    !currentGoal.target_amount ? "Target amount is required" : 
                    parseFloat(currentGoal.target_amount) <= 0 ? "Must be greater than 0" : ""
                }
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                name="target_date"
                label="Target Date"
                type="date"
                value={currentGoal.target_date}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description (Optional)"
                value={currentGoal.description || ""}
                onChange={handleChange}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            
            {editMode && (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Track Progress
                </Typography>
                <TextField
                  name="current_amount"
                  label="Current Amount ($)"
                  type="number"
                  value={currentGoal.current_amount || 0}
                  onChange={handleChange}
                  fullWidth
                  inputProps={{ min: 0, step: "0.01" }}
                  error={currentGoal.current_amount && parseFloat(currentGoal.current_amount) < 0}
                  helperText={
                      currentGoal.current_amount && parseFloat(currentGoal.current_amount) < 0 ? "Cannot be negative" : ""
                  }
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button 
            onClick={saveGoal} 
            variant="contained" 
            color="primary"
            disabled={
                saving || 
                !currentGoal.name || 
                !currentGoal.target_amount || 
                parseFloat(currentGoal.target_amount) <= 0 ||
                (currentGoal.current_amount && parseFloat(currentGoal.current_amount) < 0)
            }
          >
            {saving ? <CircularProgress size={24} /> : editMode ? "Update Goal" : "Add Goal"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default GoalsSettings;