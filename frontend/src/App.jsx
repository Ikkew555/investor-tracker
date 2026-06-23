import React from "react";
import "./App.css";
import { CssBaseline } from "@mui/material";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import SignUp from "./pages/Signup";
import PricingPage from "./pages/PricingPage";
import FeaturesPage from "./pages/FeaturesPage";

import Overview from "./pages/Overview";
import Performance from "./pages/Performance";
import ActivitiesPage from "./pages/ActivitiesPage";
import Settings from "./pages/Settings";
import Broker from "./pages/Broker";
import BrokerUpload from "./pages/BrokerUpload";
import ToolsPage from "./pages/Tools";
import TaxPage from "./pages/Tax/Tax";
import AdminDashboard from "./pages/AdminDashboard";

import { useAuth } from "./contexts/AuthContext";
import { useTheme } from "./contexts/ThemeContext";

const IncomePage = () => <div>Income Page</div>;

function AppContent() {
  const { isAuthenticated } = useAuth();
  const { mode } = useTheme();
  const location = useLocation();

  const hideHeaderRoutes = ["/"];
  const shouldHideHeader = hideHeaderRoutes.includes(location.pathname);

  return (
    <>
      <CssBaseline />

      <div className={`app ${mode}-mode`}>
        {!shouldHideHeader && <Header />}

        <div className="content">
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route
              path="/login"
              element={
                isAuthenticated ? <Navigate to="/overview" /> : <Login />
              }
            />

            <Route
              path="/signup"
              element={
                isAuthenticated ? <Navigate to="/overview" /> : <SignUp />
              }
            />

            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/features" element={<FeaturesPage />} />

            <Route path="/home" element={<Navigate to="/overview" replace />} />

            <Route
              path="/overview"
              element={
                <ProtectedRoute>
                  <Overview />
                </ProtectedRoute>
              }
            />

            <Route
              path="/performance"
              element={
                <ProtectedRoute>
                  <Performance />
                </ProtectedRoute>
              }
            />

            <Route
              path="/income"
              element={
                <ProtectedRoute>
                  <IncomePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/activities"
              element={
                <ProtectedRoute>
                  <ActivitiesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/brokers"
              element={
                <ProtectedRoute>
                  <Broker />
                </ProtectedRoute>
              }
            />

            <Route
              path="/brokers/:brokerId"
              element={
                <ProtectedRoute>
                  <BrokerUpload />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tax"
              element={
                <ProtectedRoute>
                  <TaxPage />
                </ProtectedRoute>
              }
            />
            {/* Redirect old /taxs links to /tax */}
            <Route path="/taxs" element={<Navigate to="/tax" replace />} />

            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <ToolsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/*"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            <Route
              path="*"
              element={
                <Navigate to={isAuthenticated ? "/overview" : "/"} replace />
              }
            />
          </Routes>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;