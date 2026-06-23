# Portfolio Tracker: Solution Design Overview

**Version:** 1.0
**Date:** 19/05/2025

## 1. Introduction

This document outlines the high-level solution design for the Portfolio Tracker web application. The application aims to provide users with a platform to consolidate, track, and analyze their investment portfolios imported from various brokerage accounts.

## 2. Goals

*   **User-Friendly Interface:** Intuitive and easy to navigate for managing financial data.
*   **Data Consolidation:** Allow import of transaction data from multiple brokers.
*   **Portfolio Tracking:** Provide clear views of current holdings and their values.
*   **Performance Analysis:** Offer basic tools and charts to understand investment performance.
*   **Secure User Data:** Ensure user authentication and data privacy.
*   **Customization:** Allow users to set preferences like base currency and themes.

## 3. Core Architecture

The system follows a **client-server architecture** with a modern web frontend and a Backend-as-a-Service (BaaS) platform.

*   **Frontend (Client-Side):**
    *   **Technology:** Single Page Application (SPA) built with **React** and **Vite**.
    *   **Responsibilities:**
        *   Rendering the user interface and handling user interactions.
        *   Client-side routing and navigation.
        *   Managing UI state.
        *   Making API calls to the backend for data and authentication.
        *   Parsing and processing CSV files for transaction import.
*   **Backend (Server-Side):**
    *   **Technology:** **Supabase** (PostgreSQL database, Authentication, auto-generated APIs).
    *   **Responsibilities:**
        *   Secure user authentication and authorization.
        *   Persistent data storage (user profiles, transactions, holdings, settings).
        *   Serving data to the frontend via its RESTful API.
        *   Enforcing data security through Row Level Security (RLS).

## 4. Key Modules & Functionality

### 4.1. User Management & Authentication

*   **Signup/Login:** Secure user registration and login using Supabase Auth (email/password).
*   **Session Management:** Handled by Supabase, with frontend state managed via `AuthContext`.
*   **Profile Management:** Basic user profile information stored in the `profiles` table, linked to `auth.users`.
*   **Role-Based Access (Basic):**
    *   `ProtectedRoute` for authenticated user access.
    *   `AdminRoute` for administrative functions (currently relies on a `role` attribute in user data).

### 4.2. Data Import & Management

*   **CSV Import:**
    *   Primary method for ingesting transaction data.
    *   Supports multiple broker formats (Sharesight, HSBC, other generic formats) via `EnhancedCSVUploader` and `BrokerCSVUploader`.
    *   Client-side parsing (`papaparse`) and mapping to a standardized internal format.
*   **Manual Transaction Entry:** Form-based input for individual transactions.
*   **Data Storage:**
    *   `activities` table: Stores all individual transactions (buys, sells, dividends).
    *   `securities` table: Stores details of financial instruments.
    *   `brokers` table: Stores user-defined broker accounts.

### 4.3. Portfolio Viewing & Analysis

*   **Holdings View:**
    *   Aggregates `activities` data to display current holdings.
    *   Visualizations (pie charts via Recharts) for allocation by asset class, currency, country, sector.
*   **Performance View:**
    *   Charts (line, area, bar via Recharts) showing portfolio value over time and diversification.
    *   Table display of assets with basic return metrics (requires backend processing not fully detailed).
*   **Reporting:**
    *   Generates reports like "All Trades," "Sold Securities," "Taxable Income."
    *   Primarily involves filtering and presenting data from the `activities` table.

### 4.4. Settings & Customization

*   **User Preferences:**
    *   Base currency selection.
    *   Custom exchange rate management.
    *   Theme selection (light/dark), managed via `ThemeContext` and persisted.
*   **Account Management:** Users can define and categorize their financial accounts (brokers, savings, etc.).
*   **Financial Goals & Limits:** Users can set and track contribution limits and investment goals (data stored within `user_settings.notification_preferences`).
*   **Data Export:** Allows users to download their data in JSON, CSV, or SQL formats.

### 4.5. Administration (Basic)

*   **Admin Dashboard:**
    *   View user list.
    *   Modify user account types/roles (simulated for some actions due to client-side limitations).
    *   Configure system-wide settings (e.g., default currency, upload limits).

## 5. Data Flow Overview

1.  **User Authentication:** User -> Frontend (Login/Signup Page) -> Supabase Auth. Session token returned to Frontend.
2.  **Data Import (CSV):** User uploads CSV -> Frontend (Parses & Processes) -> Frontend constructs data payload -> `src/lib/supabase.js` -> Supabase Database (inserts into `activities`, `securities`, `brokers`).
3.  **Manual Transaction:** User fills form -> Frontend constructs data payload -> `src/lib/supabase.js` -> Supabase Database.
4.  **Data Viewing (Holdings, Performance):** Frontend Page Mount/User Action -> `src/lib/supabase.js` -> Supabase Database (queries `activities`, `holdings`, `securities`) -> Data returned to Frontend -> Frontend processes and renders.
5.  **Settings Update:** User changes setting -> Frontend constructs payload -> `src/lib/supabase.js` -> Supabase Database (updates `user_settings` or other relevant tables).

## 6. User Interface (UI) Design Principles

*   **Component-Based:** Leverages React components for modularity.
*   **MUI Framework:** Utilizes Material-UI for a consistent, modern look and feel, and responsive design.
*   **Theming:** Supports light and dark modes for user preference.
*   **Clarity & Simplicity:** Aims for straightforward presentation of financial data.

## 7. Security Considerations

*   **Authentication:** Relies on Supabase Auth for secure credential handling and session management.
*   **Authorization:**
    *   Client-side route protection (`ProtectedRoute`, `AdminRoute`).
    *   **Crucially, Supabase Row Level Security (RLS)** on database tables ensures users can only access their own data.
*   **Input Validation:** Basic client-side validation on forms. Server-side validation is implicitly handled by Supabase for data types, but complex business rule validation would need explicit Supabase functions if required.
*   **Environment Variables:** Supabase keys are intended to be stored in `.env` files and not hardcoded directly in client-side bundles for production.

## 8. Scalability & Maintainability

*   **Supabase:** As a BaaS, Supabase handles much of the backend scaling concerns (database, auth).
*   **React & Vite:** Modern frontend stack designed for performance and maintainability.
*   **Modular Structure:** Code is organized into components, pages, contexts, and services, aiding in maintainability.
*   **Centralized Supabase Logic:** `src/lib/supabase.js` acts as a single interface to the backend, making it easier to manage API interactions.

## 9. Deployment

*   **Frontend:** Static site build generated by `npm run build` (Vite). Deployable to any static hosting provider (Netlify, Vercel, AWS S3, etc.).
*   **Backend:** Managed by Supabase.

## 10. Limitations & Future Scope (High-Level)

*   **Real-time Data:** Currently lacks real-time market price updates.
*   **Advanced Analytics:** Current analytics are basic; more sophisticated metrics could be added.
*   **Direct Broker Integration:** Relies on CSV; direct API integration would improve user experience.
*   **Automated Tasks:** No current mechanism for automated tasks like daily portfolio snapshotting (would require Supabase Functions).
*   **Comprehensive Admin Controls:** True admin user management requires secure backend functions.