import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProviderWrapper } from "./contexts/ThemeContext";
import "./theme.css";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 20,   // 20 min default (Group A engines)
      gcTime: 1000 * 60 * 60,      // 1 hour garbage collection
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProviderWrapper>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProviderWrapper>
    </QueryClientProvider>
  </React.StrictMode>
);
  