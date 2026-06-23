// Header.jsx

import React, { useState } from "react";
import "./Header.css";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";
import {
  // Button, // Removed unused import
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
  IconButton,
  Typography,
} from "@mui/material";
import {
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
} from "@mui/icons-material";

function Header() {
  const { isAuthenticated, signOut, user } = useAuth(); // user should have user.profile.is_admin
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Use is_admin from the profile data attached to the user object
  const isAdmin = user?.profile?.is_admin === true;

  const handleSignOut = async () => {
    handleClose();
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Sign out failed:", err);
      // Show error to user
    }
  };

  const handleProfileOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const navigateToProfile = () => {
    navigate("/settings", { state: { activeTab: "Your Profile" } });
    handleClose();
  };

  const navigateToDashboard = () => {
    navigate("/admin");
    handleClose();
  };

  const getLinkClass = ({ isActive }) => (isActive ? "active nav-link-active" : "nav-link"); // Added base class

  const getAvatarInitials = () => {
    if (user?.user_metadata?.display_name) {
      const names = user.user_metadata.display_name.split(' ');
      if (names.length > 1 && names[0] && names[names.length - 1]) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0]?.[0]?.toUpperCase() || 'U';
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };


  return (
    <header className="header">
      <div className="logo">
        <Link to="/home" style={{ textDecoration: "none", color: "inherit" }}>
          Portfolio Tracker
        </Link>
      </div>
      <nav className="nav">
        {/* {isAuthenticated ? (
          <ul>
            <li><NavLink to="/home" className={getLinkClass}>Overview</NavLink></li>
            <li><NavLink to="/brokers" className={getLinkClass}>Brokers</NavLink></li>
            <li><NavLink to="/holdings" className={getLinkClass}>Holdings</NavLink></li>
            <li><NavLink to="/reports" className={getLinkClass}>Reports</NavLink></li>
          </ul>
        ) : (
          <ul>
            <li><NavLink to="/login" className={getLinkClass}>Login</NavLink></li>
            <li><NavLink to="/signup" className={getLinkClass}>Sign Up</NavLink></li>
          </ul>
        )} */}

      
          <ul>
            <li><NavLink to="/home" className={getLinkClass}>Overview</NavLink></li>
            <li><NavLink to="/brokers" className={getLinkClass}>Brokers</NavLink></li>
            <li><NavLink to="/tools" className={getLinkClass}>Tools</NavLink></li>
            <li><NavLink to="/tax" className={getLinkClass}>Tax</NavLink></li>
            {/* <li><NavLink to="/holdings" className={getLinkClass}>Holdings</NavLink></li>
            <li><NavLink to="/reports" className={getLinkClass}>Reports</NavLink></li> */}
          </ul>
      </nav>
      <div className="user-controls">
        <ThemeToggle />
        {isAuthenticated && user && ( // Added user check for safety
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <IconButton
              onClick={handleProfileOpen}
              size="small"
              aria-controls={open ? "profile-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              title="Account settings"
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }}>
                {getAvatarInitials()}
              </Avatar>
            </IconButton>
            <Menu
              id="profile-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  '& .MuiAvatar-root': { width: 32, height: 32, ml: -0.5, mr: 1 },
                  '&::before': {
                    content: '""', display: 'block', position: 'absolute',
                    top: 0, right: 14, width: 10, height: 10,
                    bgcolor: 'background.paper', transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }}
            >
              <MenuItem onClick={handleClose} disabled sx={{ '&.Mui-disabled': { opacity: 1 }}}>
                <Typography variant="body1" color="text.primary" sx={{ fontWeight: 'medium' }}>
                  {user?.user_metadata?.display_name || user?.email || "User"}
                </Typography>
              </MenuItem>
              { (user?.user_metadata?.display_name && user?.email) &&
                <MenuItem onClick={handleClose} disabled sx={{ pt: 0, pb: 0.5, '&.Mui-disabled': { opacity: 1 }}}>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </MenuItem>
              }
              <Divider />
              {isAdmin && ( // This now uses user.profile.is_admin
                <MenuItem onClick={navigateToDashboard}>
                  <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
                  Admin Dashboard
                </MenuItem>
              )}
              <MenuItem onClick={navigateToProfile}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                Your Profile
              </MenuItem>
              <MenuItem onClick={() => { navigate("/settings"); handleClose(); }}>
                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                Settings
              </MenuItem>
              <MenuItem onClick={handleSignOut}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Sign Out
              </MenuItem>
            </Menu>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;