// AdminRoute.jsx

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material'; // For loading state

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    // Optional: Show a loading indicator while auth state is being determined
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Check if the user is authenticated and their profile indicates they are an admin
  // This assumes your AuthContext provides user.profile.is_admin
  const isAdmin = isAuthenticated && user?.profile?.is_admin === true; 
  
  if (!isAdmin) {
    // If not authenticated or not an admin, redirect to home or login
    return <Navigate to={isAuthenticated ? "/home" : "/login"} replace />;
  }
  
  return children;
};

export default AdminRoute;