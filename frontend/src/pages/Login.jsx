import React, { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  Link,
  // IconButton, // Not used
  Alert,
  Divider,
} from "@mui/material";
import { Lock, Person, Google } from "@mui/icons-material"; // Added Google icon
import { styled } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const StyledPaper = styled(Paper)(({ theme }) => ({
  width: "100%",
  maxWidth: 400,
  padding: theme.spacing(4),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  margin: theme.spacing(1.5, 0, 2, 0), // Adjusted vertical spacing slightly
  width: "100%",
}));

const StyledButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 4),
  fontSize: "1rem",
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius * 2,
  margin: theme.spacing(2.5, 0, 2, 0), // Adjusted margin
}));

const LogoText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3), // Space below the logo
  fontWeight: "bold",
  color: theme.palette.primary.main, // Use primary color for logo
  textDecoration: "none", // Remove underline from link
  "&:hover": {
    color: theme.palette.primary.dark, // Darken on hover for feedback
  },
}));

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { user } = await signIn(email, password);
      console.log("Login successful", user);
      // Redirect to the intended page after login.
      // If the user was trying to access a protected route, they might be redirected there.
      // Otherwise, navigate to home or dashboard. '/' might lead to LandingPage if still unauth.
      // For now, let's assume successful sign-in implies isAuthenticated becomes true,
      // so navigating to "/" will then be handled by App.js to redirect to "/home".
      //navigate("/"); comment this line to Let React Router handle the redirect automatically
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err.message || "Failed to sign in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await signInWithGoogle();
      console.log("Google login initiated", data);
      // The redirect will be handled by Google OAuth
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to sign in with Google.");
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor={theme.palette.background.default}
    >
      <StyledPaper>
        {/* Logo Text - Clickable */}
        <LogoText
          variant="h5"
          component={RouterLink}
          to="/" // Navigate to the main landing page
        >
          Portfolio Tracker
        </LogoText>

        <Typography variant="h4" gutterBottom color="primary">
          Sign In
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <StyledTextField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            InputProps={{
              startAdornment: <Person color="action" sx={{ mr: 1 }} />,
            }}
            disabled={loading}
          />
          <StyledTextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            InputProps={{
              startAdornment: <Lock color="action" sx={{ mr: 1 }} />,
            }}
            disabled={loading}
          />
          <StyledButton
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
          >
            {loading ? "Signing In..." : "Log In"}
          </StyledButton>
          
          <Divider sx={{ my: 2 }}>OR</Divider>
          
          <StyledButton
            variant="outlined"
            color="primary"
            fullWidth
            disabled={loading}
            onClick={handleGoogleSignIn}
            startIcon={<Google />}
          >
            Sign in with Google
          </StyledButton>
          
          <Box mt={2} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{" "}
              <Link
                component={RouterLink}
                to="/signup"
                variant="subtitle2" // Keep if you like the slightly bolder look for links
                color="primary"
              >
                Create one
              </Link>
            </Typography>
          </Box>
        </form>
      </StyledPaper>
    </Box>
  );
}

export default LoginPage;
