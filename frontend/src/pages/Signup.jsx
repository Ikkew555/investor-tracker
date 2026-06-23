import React, { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  Link,
  Grid,
  Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const StyledPaper = styled(Paper)(({ theme }) => ({
  width: "100%",
  maxWidth: 550, // Increased maxWidth to make the form and fields wider
  padding: theme.spacing(4),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[8],
  backgroundColor: theme.palette.background.paper,
}));

// Corrected StyledTextField
const StyledTextField = styled(TextField)(() => ({ // Removed 'theme' from destructuring
  // The width will be controlled by the parent Grid item (fullWidth prop on TextField or width: "100%" here)
  width: "100%",
}));

const StyledButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 4),
  fontSize: "1rem",
  fontWeight: 600,
  borderRadius: theme.shape.borderRadius * 2,
  margin: theme.spacing(3, 0, 2, 0),
}));

const LogoText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  fontWeight: "bold",
  color: theme.palette.primary.main,
  textDecoration: "none",
  "&:hover": {
    color: theme.palette.primary.dark,
  },
}));

function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const theme = useTheme();
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const userData = {
        first_name: firstName,
        last_name: lastName,
      };

      const result = await signUp(email, password, userData);

      if (result && result.needsConfirmation) {
        setSuccess(true);
      } else if (result && result.user) {
        navigate("/");
      } else {
        // Fallback for unexpected result, perhaps treat as needing confirmation or show generic success
        // For now, let's assume it means confirmation is needed if user object isn't present
        setSuccess(true);
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to sign up. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor={theme.palette.background.default}
        p={2}
      >
        <StyledPaper>
          {" "}
          {/* Using StyledPaper for consistency even in success message */}
          <LogoText variant="h5" component={RouterLink} to="/">
            Portfolio Tracker
          </LogoText>
          <Typography variant="h5" gutterBottom color="primary" sx={{ mt: 2 }}>
            Verification Email Sent
          </Typography>
          <Typography variant="body1" align="center" sx={{ mb: 3 }}>
            A confirmation email has been sent to {email}. Please check your
            inbox and click the link to confirm your account.
          </Typography>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            color="primary"
          >
            Return to Login
          </Button>
        </StyledPaper>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor={theme.palette.background.default}
      p={2}
    >
      <StyledPaper>
        <LogoText variant="h5" component={RouterLink} to="/">
          Portfolio Tracker
        </LogoText>

        <Typography variant="h4" gutterBottom color="primary">
          Create Account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
            {error}
          </Alert>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", marginTop: theme.spacing(1) }}
        >
          {/* Grid container will manage spacing between rows of fields */}
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <StyledTextField
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                fullWidth // Ensures it takes full width of Grid item
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <StyledTextField
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                fullWidth // Ensures it takes full width of Grid item
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <StyledTextField
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <StyledTextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <StyledTextField
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                fullWidth
                disabled={loading}
              />
            </Grid>
          </Grid>
          <StyledButton
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </StyledButton>

          <Box mt={2} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              Already have an account?{" "}
              <Link
                component={RouterLink}
                to="/login"
                variant="subtitle2"
                color="primary"
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </form>
      </StyledPaper>
    </Box>
  );
}

export default SignupPage;