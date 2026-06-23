-- =============================================================================
-- INTERMEDIATE TABLES & VIEWS
-- =============================================================================
-- dbt-managed models that sit between raw source tables and mart tables.
-- Run source_tables.sql first, then apply this file.
--
-- IMPORTANT — two materialization types are used:
--
--   VIEW  (no dbt rebuild needed per user trigger):
--     int_parcels, int_disposals, int_dividends, int_securities_meta
--     → Always read fresh from activities / securities source tables.
--     → CREATE OR REPLACE VIEW is idempotent and concurrent-safe.
--     → Cannot have RLS (PostgreSQL limitation on views).
--
--   TABLE (rebuilt by scheduled DAGs — NOT per-user trigger):
--     int_latest_prices    → rebuilt every 15 min by scheduled_market_price_dag
--     int_latest_fx_rates  → rebuilt hourly by scheduled_fx_rate_dag
--     int_dividend_frequency   → rebuilt daily by scheduled_dividend_franking_dag
--     int_upcoming_dividends   → rebuilt daily by scheduled_dividend_franking_dag
--
-- These are defined here as plain SQL for documentation and manual recovery.
-- dbt is the authoritative source — run `dbt run --select <model>` to recreate.
-- =============================================================================


-- ── VIEWS (always fresh — no rebuild needed) ──────────────────────────────────

-- stg_activities: clean, type-cast staging view over activities table.
-- Filters invalid rows; downstream int_* views reference this.
CREATE VIEW stg_activities AS
SELECT
    id,
    user_id,
    security_id,
    broker_id,
    upper(type)                                          AS type,
    date,
    round(cast(quantity     AS numeric), 6)              AS quantity,
    round(cast(price        AS numeric), 6)              AS price,
    round(cast(total_amount AS numeric), 6)              AS total_amount,
    round(coalesce(cast(fees AS numeric), 0), 6)         AS fees,
    round(coalesce(cast(franking_percent AS numeric), 0), 6) AS franking_percent,
    round(coalesce(cast(franking_credits AS numeric), 0), 6) AS franking_credits,
    currency,
    notes
FROM activities
WHERE user_id    IS NOT NULL
  AND type       IS NOT NULL
  AND (total_amount IS NOT NULL OR upper(type) = 'BUY')
ORDER BY date ASC;


-- int_parcels: one row per BUY activity, shaped as a parcel for the calc engine.
-- cost_base = qty × price + fees (total acquisition cost).
-- Materialized as VIEW — always reflects the latest activities without rebuilding.
CREATE OR REPLACE VIEW int_parcels AS
SELECT
    a.id                                                      AS parcel_id,
    a.user_id,
    a.security_id,
    s.symbol,
    a.date                                                    AS acquired_date,
    a.quantity,
    (a.quantity * a.price + a.fees)                          AS cost_base
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'BUY'
  AND a.quantity > 0
ORDER BY a.user_id, a.date ASC;


-- int_disposals: one row per SELL activity, shaped as a disposal for the calc engine.
-- Materialized as VIEW — always reflects the latest activities without rebuilding.
CREATE OR REPLACE VIEW int_disposals AS
SELECT
    a.id                  AS disposal_id,
    a.user_id,
    s.symbol,
    a.date                AS disposal_date,
    a.quantity,
    a.total_amount        AS gross_proceeds,
    a.fees                AS brokerage
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'SELL'
  AND a.quantity > 0
ORDER BY a.user_id, a.date ASC;


-- int_dividends: one row per DIVIDEND activity, shaped for the tax engine.
-- Materialized as VIEW — always reflects the latest activities without rebuilding.
CREATE VIEW int_dividends AS
SELECT
    a.id              AS dividend_id,
    a.user_id,
    s.symbol,
    a.date            AS payment_date,
    a.total_amount    AS cash_amount,
    a.franking_percent,
    a.franking_credits
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'DIVIDEND'
ORDER BY a.user_id, a.date ASC;


-- int_securities_meta: symbol metadata for enrichment in the calc engine.
-- Materialized as VIEW — always reads latest from securities table.
-- Also rebuilt by scheduled_market_price_dag dbt step (safe: max_active_runs=1).
CREATE OR REPLACE VIEW int_securities_meta AS
SELECT
    symbol,
    name,
    asset_class,
    sector,
    country,
    exchange,
    currency
FROM securities
WHERE symbol IS NOT NULL;


-- ── TABLES (rebuilt by scheduled DAGs — do NOT rebuild per user trigger) ──────

-- int_latest_prices: most recent price snapshot per symbol.
-- Source: stg_market_data → raw_market_data (via DISTINCT ON symbol).
-- Rebuilt every 15 min by scheduled_market_price_dag after each price fetch.
-- Read by: calculations/main.py _load_inputs() for all market-data engines.
CREATE TABLE IF NOT EXISTS int_latest_prices (
    symbol               TEXT        NOT NULL PRIMARY KEY,
    exchange             TEXT,
    currency             TEXT,
    regular_market_price NUMERIC(20, 6),
    open                 NUMERIC(20, 6),
    close                NUMERIC(20, 6),
    dividend_rate        NUMERIC(20, 6),
    sector               TEXT,
    industry             TEXT,
    fetched_at           TIMESTAMPTZ
);


-- int_latest_fx_rates: most recent FX rate per currency pair (to AUD).
-- Source: stg_fx_rates → raw_fx_rates (via DISTINCT ON from/to currency).
-- Rebuilt hourly by scheduled_fx_rate_dag.
-- Read by: calculations/main.py _load_inputs() for multi_currency engine.
CREATE TABLE IF NOT EXISTS int_latest_fx_rates (
    from_currency TEXT        NOT NULL,
    to_currency   TEXT        NOT NULL,   -- always 'AUD'
    rate          NUMERIC(20, 6) NOT NULL,
    fetched_at    TIMESTAMPTZ,
    PRIMARY KEY (from_currency, to_currency)
);


-- int_dividend_frequency: inferred historical payment frequency per symbol.
-- Computed from gaps between consecutive ex_dates in raw_dividend_data.
-- Rebuilt daily by scheduled_dividend_franking_dag.
-- Read by: int_upcoming_dividends (joined to project next payment date).
CREATE TABLE IF NOT EXISTS int_dividend_frequency (
    symbol          TEXT    NOT NULL PRIMARY KEY,
    avg_gap_days    INT,               -- average days between ex_dates
    payment_count   INT,               -- number of historical payments observed
    frequency_label TEXT               -- 'monthly'|'quarterly'|'semi_annual'|'annual'
);


-- int_upcoming_dividends: next projected dividend per symbol.
-- One row per symbol: latest known dividend + projected next ex_date + annualised DPS.
-- Rebuilt daily by scheduled_dividend_franking_dag.
-- Read by: calculations/main.py _load_inputs() for future_income and calendar engines.
CREATE TABLE IF NOT EXISTS int_upcoming_dividends (
    symbol                  TEXT        NOT NULL PRIMARY KEY,
    last_ex_date            DATE,
    last_payment_date       DATE,
    dividend_per_unit       NUMERIC(20, 6),
    dividend_type           TEXT,
    franking_pct            NUMERIC(5, 2),
    currency                TEXT,
    source                  TEXT,
    avg_gap_days            INT,
    frequency_label         TEXT,
    payment_count           INT,
    projected_next_ex_date  DATE,
    annual_dps              NUMERIC(20, 6)   -- dividend_per_unit × (365 / avg_gap_days)
);



-- int_parcels
CREATE OR REPLACE VIEW int_parcels AS
SELECT
    a.id                                AS parcel_id,
    a.user_id,
    a.security_id,
    s.symbol,
    a.date                              AS acquired_date,
    a.quantity,
    (a.quantity * a.price + a.fees)     AS cost_base
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'BUY' AND a.quantity > 0
ORDER BY a.user_id, a.date ASC;

-- int_disposals
CREATE OR REPLACE VIEW int_disposals AS
SELECT
    a.id              AS disposal_id,
    a.user_id,
    s.symbol,
    a.date            AS disposal_date,
    a.quantity,
    a.total_amount    AS gross_proceeds,
    a.fees            AS brokerage
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'SELL' AND a.quantity > 0
ORDER BY a.user_id, a.date ASC;

-- int_dividends
CREATE OR REPLACE VIEW int_dividends AS
SELECT
    a.id              AS dividend_id,
    a.user_id,
    s.symbol,
    a.date            AS payment_date,
    a.total_amount    AS cash_amount,
    a.franking_percent,
    a.franking_credits
FROM stg_activities a
JOIN securities s ON s.id = a.security_id
WHERE a.type = 'DIVIDEND'
ORDER BY a.user_id, a.date ASC;

-- int_securities_meta
CREATE OR REPLACE VIEW int_securities_meta AS
SELECT symbol, name, asset_class, sector, country, exchange, currency
FROM securities
WHERE symbol IS NOT NULL;