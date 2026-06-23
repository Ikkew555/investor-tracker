-- =============================================================================
-- SOURCE TABLES
-- =============================================================================
-- Core application tables and raw ingestion tables.
-- Run this file once during initial setup (before int_tables.sql and mart_tables.sql).
--
-- Tables defined here:
--   Core:   profiles, brokers, securities, activities, user_settings
--   System: data_freshness, engine_run_state
--   Raw:    raw_market_data, raw_fx_rates, raw_dividend_data
--   Helper: get_users_holding_symbols() RPC function
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── profiles ──────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with display fields.
-- Auto-created by trigger on auth.users insert.

CREATE TABLE IF NOT EXISTS profiles (
    id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email       TEXT        NOT NULL,
    first_name  TEXT,
    last_name   TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$;

CREATE TRIGGER create_profile_after_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_user();


-- ── brokers ───────────────────────────────────────────────────────────────────
-- User's broker/platform accounts (CommSec, SelfWealth, etc.).

CREATE TABLE IF NOT EXISTS brokers (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    description TEXT,
    logo_url    TEXT,
    credentials JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brokers"
    ON brokers FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brokers"
    ON brokers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brokers"
    ON brokers FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brokers"
    ON brokers FOR DELETE USING (auth.uid() = user_id);


-- ── securities ────────────────────────────────────────────────────────────────
-- Master list of stocks, ETFs, and other tradeable instruments.
-- Populated once and updated as new symbols are encountered.

CREATE TABLE IF NOT EXISTS securities (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol      TEXT        NOT NULL,
    name        TEXT        NOT NULL,
    asset_class TEXT        NOT NULL,   -- 'Equity' | 'ETF' | 'Fixed Income' | etc.
    sector      TEXT,
    country     TEXT,
    currency    TEXT        NOT NULL,
    exchange    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (symbol, exchange)
);

ALTER TABLE securities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view securities"
    ON securities FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_securities_symbol ON securities (symbol);


-- ── activities ────────────────────────────────────────────────────────────────
-- All user transactions: BUY, SELL, DIVIDEND, DEPOSIT, WITHDRAWAL.
-- Append-only from the user perspective; never updated after insert.

CREATE TABLE IF NOT EXISTS activities (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    security_id      UUID        REFERENCES securities(id) ON DELETE CASCADE,
    broker_id        UUID        REFERENCES brokers(id) ON DELETE SET NULL,
    type             TEXT        NOT NULL,   -- 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL'
    date             TIMESTAMPTZ NOT NULL,
    quantity         NUMERIC(19, 8),
    price            NUMERIC(19, 8),
    total_amount     NUMERIC(19, 8) NOT NULL,
    fees             NUMERIC(19, 8),
    currency         TEXT        NOT NULL,
    notes            TEXT,
    -- Tax / dividend fields
    franking_percent NUMERIC(5, 2),
    franking_credits NUMERIC(19, 8),
    reduced_cost_base NUMERIC(19, 8),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities"
    ON activities FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
    ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
    ON activities FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
    ON activities FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities (user_id);
CREATE INDEX IF NOT EXISTS idx_activities_date     ON activities (date);
CREATE INDEX IF NOT EXISTS idx_activities_user_updated ON activities (user_id, updated_at DESC);


-- ── user_settings ─────────────────────────────────────────────────────────────
-- Per-user preferences and tax configuration.
-- One row per user (UNIQUE user_id).

CREATE TABLE IF NOT EXISTS user_settings (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_currency    TEXT        NOT NULL DEFAULT 'AUD',
    theme               TEXT                 DEFAULT 'light',
    notification_preferences JSONB           DEFAULT '{}',
    entity_type         TEXT        NOT NULL DEFAULT 'individual',  -- 'individual'|'trust'|'smsf'|'company'
    parcel_matching     TEXT        NOT NULL DEFAULT 'fifo',        -- 'fifo'|'lifo'|'minimise_tax'
    cgt_method          TEXT        NOT NULL DEFAULT 'auto',        -- 'auto'|'discount'|'indexation'|'other'
    prior_year_loss     NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id),
    CONSTRAINT chk_entity_type     CHECK (entity_type    IN ('individual','trust','smsf','company')),
    CONSTRAINT chk_parcel_matching CHECK (parcel_matching IN ('fifo','lifo','minimise_tax')),
    CONSTRAINT chk_cgt_method      CHECK (cgt_method      IN ('auto','discount','indexation','other'))
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
    ON user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings"
    ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON user_settings FOR UPDATE USING (auth.uid() = user_id);


-- ── data_freshness ────────────────────────────────────────────────────────────
-- Single row per (data_type, symbol/currency_pair).
-- Upserted by scheduled DAGs after every successful or failed fetch.
-- Downstream engines log a warning when is_stale=TRUE but still proceed.

CREATE TABLE IF NOT EXISTS data_freshness (
    id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    data_type     TEXT        NOT NULL,   -- 'market_price' | 'fx_rate' | 'dividend'
    symbol        TEXT,                   -- populated for data_type='market_price'
    currency_pair TEXT,                   -- populated for data_type='fx_rate' e.g. 'USD_AUD'
    last_updated  TIMESTAMPTZ NOT NULL,
    is_stale      BOOLEAN     NOT NULL DEFAULT FALSE,
    fetch_status  TEXT        NOT NULL DEFAULT 'ok',  -- 'ok' | 'failed' | 'partial'
    error_detail  TEXT,
    UNIQUE (data_type, symbol, currency_pair)
);

CREATE INDEX IF NOT EXISTS idx_freshness_type_symbol ON data_freshness (data_type, symbol);
CREATE INDEX IF NOT EXISTS idx_freshness_stale        ON data_freshness (is_stale) WHERE is_stale = TRUE;

COMMENT ON TABLE data_freshness IS
    'Single row per (data_type, symbol/currency_pair). Upserted on every scheduled fetch. '
    'is_stale=TRUE means the last fetch failed; downstream engines still run but log a warning.';


-- ── engine_run_state ──────────────────────────────────────────────────────────
-- Central coordination table for smart re-calculation.
-- One row per (user_id, engine_name). is_stale=TRUE → engine must re-run.
-- Written by: trigger_logic.py (on user transaction), scheduled DAGs (on market data update).
-- Read by: tax_user_calc_dag, market_user_calc_dag (staleness skip logic).

CREATE TABLE IF NOT EXISTS engine_run_state (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    engine_name         TEXT        NOT NULL,  -- 'performance'|'contribution_analysis'|'multi_period'
                                               -- |'multi_currency'|'future_income'
                                               -- |'sold_securities'|'tax'|'calendar'
    last_run_id         UUID,
    last_run_at         TIMESTAMPTZ,
    is_stale            BOOLEAN     NOT NULL DEFAULT TRUE,
    stale_reason        TEXT,                  -- 'user_transaction'|'price_update'|'fx_update'
                                               -- |'dividend_update'|'never_run'
    inputs_hash         TEXT,                  -- SHA-256 of serialised inputs; skip if unchanged
    last_activity_count INT,
    UNIQUE (user_id, engine_name)
);

CREATE INDEX IF NOT EXISTS idx_engine_run_state_user   ON engine_run_state (user_id);
CREATE INDEX IF NOT EXISTS idx_engine_run_state_stale  ON engine_run_state (is_stale) WHERE is_stale = TRUE;
CREATE INDEX IF NOT EXISTS idx_engine_run_state_user_engine ON engine_run_state (user_id, engine_name);

ALTER TABLE engine_run_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY engine_run_state_select_own
    ON engine_run_state FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE engine_run_state IS
    'One row per (user, engine). is_stale=TRUE means the engine needs to re-run. '
    'The calc DAGs use this to skip engines whose inputs have not changed.';


-- ── raw_market_data ───────────────────────────────────────────────────────────
-- Append-only price snapshots from Yahoo Finance.
-- Written by scheduled_market_price_dag every 15 min during ASX trading hours.
-- Read by dbt: stg_market_data → int_latest_prices.

CREATE TABLE IF NOT EXISTS raw_market_data (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol               TEXT        NOT NULL,
    exchange             TEXT,
    currency             TEXT,
    regular_market_price NUMERIC(20, 6),
    open                 NUMERIC(20, 6),
    close                NUMERIC(20, 6),
    dividend_rate        NUMERIC(20, 6),
    dividend_yield       NUMERIC(20, 6),
    last_dividend_date   DATE,
    last_dividend_value  NUMERIC(20, 6),
    sector               TEXT,
    industry             TEXT,
    fetched_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_market_data_symbol         ON raw_market_data (symbol);
CREATE INDEX IF NOT EXISTS idx_raw_market_data_fetched_at     ON raw_market_data (fetched_at);
CREATE INDEX IF NOT EXISTS idx_raw_market_data_symbol_fetched ON raw_market_data (symbol, fetched_at DESC);

ALTER TABLE raw_market_data ENABLE ROW LEVEL SECURITY;
-- Service role only — no direct user access


-- ── raw_fx_rates ──────────────────────────────────────────────────────────────
-- Append-only FX rate snapshots (to AUD).
-- Written by scheduled_fx_rate_dag hourly.
-- Read by dbt: stg_fx_rates → int_latest_fx_rates.

CREATE TABLE IF NOT EXISTS raw_fx_rates (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT        NOT NULL,           -- e.g. 'USD', 'GBP'
    to_currency   TEXT        NOT NULL,           -- always 'AUD'
    rate          NUMERIC(20, 6) NOT NULL,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_fx_rates_pair    ON raw_fx_rates (from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_raw_fx_rates_fetched ON raw_fx_rates (from_currency, to_currency, fetched_at DESC);

ALTER TABLE raw_fx_rates ENABLE ROW LEVEL SECURITY;
-- Service role only — no direct user access


-- ── raw_dividend_data ─────────────────────────────────────────────────────────
-- Dividend announcements fetched daily by scheduled_dividend_franking_dag.
-- Upserted on (symbol, ex_date) to keep the latest franking/amount data.
-- Read by dbt: stg_dividend_data → int_dividend_frequency → int_upcoming_dividends.

CREATE TABLE IF NOT EXISTS raw_dividend_data (
    id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol        TEXT        NOT NULL,
    ex_date       DATE,
    payment_date  DATE,
    amount        NUMERIC(18, 6),    -- dividend per unit in local currency
    dividend_type TEXT,              -- 'regular' | 'special' | 'final' | 'interim'
    franking_pct  NUMERIC(5, 2),    -- 0–100; ASX franking credit percentage
    currency      TEXT        NOT NULL DEFAULT 'AUD',
    source        TEXT,              -- 'yahoo_finance' | 'asx_announcements'
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (symbol, ex_date)
);

CREATE INDEX IF NOT EXISTS idx_raw_div_symbol_exdate ON raw_dividend_data (symbol, ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_raw_div_fetched        ON raw_dividend_data (fetched_at DESC);

COMMENT ON TABLE raw_dividend_data IS
    'Append/upsert table for external dividend announcements. '
    'franking_pct defaults to 100 for ASX stocks when not explicitly provided.';


-- ── get_users_holding_symbols() ───────────────────────────────────────────────
-- RPC helper used by scheduled DAGs to find which users hold a given set of
-- symbols — so only those users' engines are marked stale on a price update.
--
-- Usage (supabase-py):
--   client.rpc("get_users_holding_symbols", {"p_symbols": ["CBA", "BHP"]}).execute()

CREATE OR REPLACE FUNCTION get_users_holding_symbols(p_symbols TEXT[])
RETURNS TABLE (user_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT DISTINCT a.user_id
    FROM activities a
    JOIN securities s ON s.id = a.security_id
    WHERE s.symbol = ANY(p_symbols)
      AND a.type = 'BUY'
      AND a.user_id IN (
          SELECT buy_a.user_id
          FROM activities buy_a
          JOIN securities buy_s ON buy_s.id = buy_a.security_id
          WHERE buy_s.symbol = ANY(p_symbols)
            AND buy_a.type = 'BUY'
          GROUP BY buy_a.user_id, buy_a.security_id
          HAVING COALESCE(
              (SELECT SUM(sell.quantity)
               FROM activities sell
               WHERE sell.user_id  = buy_a.user_id
                 AND sell.security_id = buy_a.security_id
                 AND sell.type = 'SELL'),
              0
          ) < SUM(buy_a.quantity)
      );
$$;

GRANT EXECUTE ON FUNCTION get_users_holding_symbols(TEXT[]) TO service_role;
