-- =============================================================================
-- MART TABLES
-- =============================================================================
-- Calculation engine output tables. Append-only — never updated after insert.
-- Every pipeline run adds a new batch of rows identified by run_id.
-- The API reads only the latest run per user (ORDER BY run_at DESC LIMIT 1
-- on run_id, then fetches all rows matching that run_id).
--
-- Run source_tables.sql then int_tables.sql before this file.
--
-- Tables defined here (11 total):
--   Performance:  mart_performance, mart_contribution_analysis,
--                 mart_multi_period, mart_multi_currency
--   Income:       mart_future_income, mart_calendar_events
--   Tax (4):      mart_tax_summary, mart_tax_cgt_events,
--                 mart_tax_dividend_events, mart_tax_remaining_parcels
--   Sold:         mart_sold_securities
-- =============================================================================


-- ── mart_performance ──────────────────────────────────────────────────────────
-- One row per symbol per pipeline run.
-- Written by: performance engine (market_user_calc_dag).
-- Read by: Performance page, Overview page.

CREATE TABLE IF NOT EXISTS mart_performance (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id           UUID        NOT NULL,
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    from_date        DATE        NOT NULL,
    to_date          DATE        NOT NULL,
    symbol           TEXT        NOT NULL,
    quantity         NUMERIC(20, 6),
    cost_base        NUMERIC(20, 6),     -- total acquisition cost of remaining shares
    market_price     NUMERIC(20, 6),
    market_value     NUMERIC(20, 6),     -- current qty × latest market price
    capital_gain     NUMERIC(20, 6),
    dividend_income  NUMERIC(20, 6),
    total_return     NUMERIC(20, 6),     -- capital_gain + dividend_income
    total_return_pct NUMERIC(10, 4),
    opening_value    NUMERIC(20, 6),     -- = cost_base
    closing_value    NUMERIC(20, 6),     -- = market_value
    unrealised_gain  NUMERIC(20, 6),
    realised_gain    NUMERIC(20, 6)
);

CREATE INDEX IF NOT EXISTS idx_mart_performance_user_run ON mart_performance (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_performance_run_id   ON mart_performance (run_id);
CREATE INDEX IF NOT EXISTS idx_mart_performance_user_run_id ON mart_performance (user_id, run_id);

ALTER TABLE mart_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own performance"
    ON mart_performance FOR SELECT USING (auth.uid() = user_id);


-- ── mart_contribution_analysis ────────────────────────────────────────────────
-- Three group_type rows per symbol (holding / sector / asset_type).
-- Written by: contribution_analysis engine (market_user_calc_dag).
-- Read by: Contribution Analysis page.

CREATE TABLE IF NOT EXISTS mart_contribution_analysis (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id           UUID        NOT NULL,
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol           TEXT,                   -- NULL for sector/asset_type level rows
    sector           TEXT,
    asset_type       TEXT,
    weight_pct       NUMERIC(10, 4),         -- holding market_value / total portfolio value
    return_pct       NUMERIC(10, 4),         -- (market_value - cost_base) / cost_base × 100
    contribution_pct NUMERIC(10, 4),         -- weight_pct × return_pct / 100
    total_return     NUMERIC(20, 6),
    group_type       TEXT        NOT NULL,   -- 'holding' | 'sector' | 'asset_type'
    group_value      TEXT        NOT NULL    -- symbol, sector name, or asset class name
);

CREATE INDEX IF NOT EXISTS idx_mart_contribution_user_run ON mart_contribution_analysis (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_contribution_run_id   ON mart_contribution_analysis (run_id);

ALTER TABLE mart_contribution_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own contribution analysis"
    ON mart_contribution_analysis FOR SELECT USING (auth.uid() = user_id);


-- ── mart_multi_period ─────────────────────────────────────────────────────────
-- One row per period label per pipeline run (7 rows: 1M/3M/6M/1Y/3Y/5Y/ALL).
-- Written by: multi_period engine (market_user_calc_dag).
-- Read by: Multi-Period Returns page.

CREATE TABLE IF NOT EXISTS mart_multi_period (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id           UUID        NOT NULL,
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_label     TEXT        NOT NULL,   -- '1M'|'3M'|'6M'|'1Y'|'3Y'|'5Y'|'ALL'
    from_date        DATE        NOT NULL,
    to_date          DATE        NOT NULL,
    opening_value    NUMERIC(20, 6),
    closing_value    NUMERIC(20, 6),
    capital_gain     NUMERIC(20, 6),
    dividend_income  NUMERIC(20, 6),
    total_return     NUMERIC(20, 6),
    total_return_pct NUMERIC(10, 4)
);

CREATE INDEX IF NOT EXISTS idx_mart_multi_period_user_run ON mart_multi_period (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_multi_period_run_id   ON mart_multi_period (run_id);

ALTER TABLE mart_multi_period ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own multi period"
    ON mart_multi_period FOR SELECT USING (auth.uid() = user_id);


-- ── mart_multi_currency ───────────────────────────────────────────────────────
-- Three group_type rows per parcel: holding / currency / country.
-- Written by: multi_currency engine (market_user_calc_dag).
-- Read by: Multi-Currency Valuation page.

CREATE TABLE IF NOT EXISTS mart_multi_currency (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id              UUID        NOT NULL,
    run_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    buy_id              UUID,               -- activities.id of the BUY; NULL for group rows
    symbol              TEXT,               -- NULL for currency/country group rows
    currency            TEXT,
    country             TEXT,
    local_market_value  NUMERIC(20, 6),     -- market value in security's local currency
    market_value_base   NUMERIC(20, 6),     -- market value converted to AUD
    investment_gain     NUMERIC(20, 6),
    fx_gain             NUMERIC(20, 6),     -- 0 until historical FX rates at purchase are stored
    total_gain          NUMERIC(20, 6),
    group_type          TEXT        NOT NULL,   -- 'holding' | 'currency' | 'country'
    group_value         TEXT        NOT NULL,    -- symbol, currency code, or country name
    weight_pct          NUMERIC(10, 4)
);

CREATE INDEX IF NOT EXISTS idx_mart_multi_currency_user_run ON mart_multi_currency (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_multi_currency_run_id   ON mart_multi_currency (run_id);

ALTER TABLE mart_multi_currency ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own multi currency"
    ON mart_multi_currency FOR SELECT USING (auth.uid() = user_id);


-- ── mart_future_income ────────────────────────────────────────────────────────
-- One row per currently held symbol per pipeline run.
-- Written by: future_income engine (market_user_calc_dag).
-- Read by: Future Income page.

CREATE TABLE IF NOT EXISTS mart_future_income (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id               UUID        NOT NULL,
    run_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol               TEXT        NOT NULL,
    quantity             NUMERIC(20, 6),
    annual_dps           NUMERIC(20, 6),     -- annual dividend per share from market data
    annual_income        NUMERIC(20, 6),     -- quantity × annual_dps
    yield_pct            NUMERIC(10, 4),     -- annual_income / market_value × 100
    last_payment_date    TIMESTAMPTZ,
    last_payment_amount  NUMERIC(20, 6)
);

CREATE INDEX IF NOT EXISTS idx_mart_future_income_user_run ON mart_future_income (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_future_income_run_id   ON mart_future_income (run_id);

ALTER TABLE mart_future_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own future income"
    ON mart_future_income FOR SELECT USING (auth.uid() = user_id);


-- ── mart_calendar_events ──────────────────────────────────────────────────────
-- One row per projected future dividend event per pipeline run.
-- Written by: calendar engine (tax_user_calc_dag).
-- Read by: Calendar page.

CREATE TABLE IF NOT EXISTS mart_calendar_events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id           UUID        NOT NULL,
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_date       DATE        NOT NULL,
    symbol           TEXT        NOT NULL,
    event_type       TEXT        NOT NULL,   -- 'DIVIDEND' (extensible for splits, etc.)
    projected_amount NUMERIC(20, 6),
    frequency_days   INTEGER,                -- inferred: 30, 90, 180, or 365
    anchor_date      DATE,                   -- last known payment date used as projection base
    horizon_date     DATE                    -- end of projection window (anchor + 365 days)
);

CREATE INDEX IF NOT EXISTS idx_mart_calendar_user_run    ON mart_calendar_events (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_calendar_run_id      ON mart_calendar_events (run_id);
CREATE INDEX IF NOT EXISTS idx_mart_calendar_event_date  ON mart_calendar_events (user_id, event_date ASC);

ALTER TABLE mart_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own calendar events"
    ON mart_calendar_events FOR SELECT USING (auth.uid() = user_id);


-- ── mart_sold_securities ──────────────────────────────────────────────────────
-- One row per SELL activity per pipeline run.
-- Written by: sold_securities engine (tax_user_calc_dag).
-- Read by: Sold Securities page.

CREATE TABLE IF NOT EXISTS mart_sold_securities (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id         UUID        NOT NULL,
    run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sell_id        UUID,               -- activities.id of the SELL
    symbol         TEXT        NOT NULL,
    sell_date      TIMESTAMPTZ,
    quantity       NUMERIC(20, 6),
    gross_proceeds NUMERIC(20, 6),
    broker_fees    NUMERIC(20, 6),
    net_proceeds   NUMERIC(20, 6),     -- gross_proceeds - broker_fees
    cost_base      NUMERIC(20, 6),     -- FIFO cost of shares sold
    realised_gain  NUMERIC(20, 6),     -- net_proceeds - cost_base
    holding_days   INTEGER,
    is_gain        BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_mart_sold_securities_user_run ON mart_sold_securities (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_sold_securities_run_id   ON mart_sold_securities (run_id);

ALTER TABLE mart_sold_securities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sold securities"
    ON mart_sold_securities FOR SELECT USING (auth.uid() = user_id);


-- ── mart_tax_summary ──────────────────────────────────────────────────────────
-- One row per financial year per pipeline run.
-- Written by: tax engine (tax_user_calc_dag).
-- Read by: Tax landing page (franking meter, key metrics).

CREATE TABLE IF NOT EXISTS mart_tax_summary (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id      UUID        NOT NULL,
    run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT,
    engine_version      TEXT,
    calculated_at       TIMESTAMPTZ,
    financial_year      TEXT,           -- e.g. 'FY2025'
    entity_type         TEXT,           -- 'individual'|'trust'|'super'|'company'
    parcel_matching     TEXT,           -- 'fifo'|'lifo'|'minimise_tax'
    cgt_method_config   TEXT,           -- 'auto'|'discount'|'indexation'|'other'
    total_gross_gains                       NUMERIC(20, 2),
    total_cgt_discount_applied              NUMERIC(20, 2),
    total_net_gains_after_discount          NUMERIC(20, 2),
    total_capital_losses                    NUMERIC(20, 2),
    prior_year_carried_forward_loss_applied NUMERIC(20, 2),
    net_capital_gain                        NUMERIC(20, 2),
    new_carried_forward_loss                NUMERIC(20, 2),
    total_cash_dividends    NUMERIC(20, 2),
    total_franking_credits  NUMERIC(20, 2),
    total_grossed_up_income NUMERIC(20, 2),
    cgt_event_count         INTEGER,
    dividend_event_count    INTEGER,
    remaining_parcel_count  INTEGER,
    disposal_error_count    INTEGER,
    UNIQUE (user_id, run_id, financial_year)
);

CREATE INDEX IF NOT EXISTS idx_mart_tax_summary_user_run ON mart_tax_summary (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_tax_summary_run_id   ON mart_tax_summary (run_id);
CREATE INDEX IF NOT EXISTS idx_mart_tax_summary_fy       ON mart_tax_summary (user_id, financial_year);

ALTER TABLE mart_tax_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tax summary"
    ON mart_tax_summary FOR SELECT USING (auth.uid() = user_id);


-- ── mart_tax_cgt_events ───────────────────────────────────────────────────────
-- One row per BUY×SELL parcel match per financial year per run.
-- Written by: tax engine (tax_user_calc_dag).
-- Read by: CGT Events report, CGT Summary report, Method Breakdown report.

CREATE TABLE IF NOT EXISTS mart_tax_cgt_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id      UUID        NOT NULL,
    run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    financial_year  TEXT    NOT NULL,
    parcel_id       TEXT,               -- activities.id of the BUY
    disposal_id     TEXT,               -- activities.id of the SELL
    symbol          TEXT,
    acquired_date   DATE,
    disposal_date   DATE,
    holding_days    INTEGER,
    units_disposed      NUMERIC(20, 6),
    cost_base           NUMERIC(20, 2),
    indexed_cost_base   NUMERIC(20, 2),  -- CPI-adjusted for pre-21-Sep-1999 acquisitions
    proceeds            NUMERIC(20, 2),
    raw_gain            NUMERIC(20, 2),
    cgt_method          TEXT,            -- 'discount'|'indexation'|'other'|'loss'
    discount_rate       NUMERIC(8, 4),
    discount_applied    NUMERIC(20, 2),
    net_gain            NUMERIC(20, 2),
    capital_loss        NUMERIC(20, 2),
    is_loss             BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_mart_tax_cgt_events_user_run ON mart_tax_cgt_events (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_tax_cgt_events_run_id   ON mart_tax_cgt_events (run_id);
CREATE INDEX IF NOT EXISTS idx_mart_tax_cgt_events_user_fy  ON mart_tax_cgt_events (user_id, financial_year);

ALTER TABLE mart_tax_cgt_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own CGT events"
    ON mart_tax_cgt_events FOR SELECT USING (auth.uid() = user_id);


-- ── mart_tax_dividend_events ──────────────────────────────────────────────────
-- One row per dividend payment in the financial year per run.
-- Written by: tax engine (tax_user_calc_dag).
-- Read by: Dividend Events report, Taxable Income page.

CREATE TABLE IF NOT EXISTS mart_tax_dividend_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id      UUID        NOT NULL,
    run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    financial_year      TEXT    NOT NULL,
    dividend_id         TEXT,               -- activities.id of the DIVIDEND
    symbol              TEXT,
    payment_date        DATE,
    cash_amount         NUMERIC(20, 2),
    franking_percent    NUMERIC(8, 2),      -- 0–100
    franking_credits    NUMERIC(20, 2),
    grossed_up_dividend NUMERIC(20, 2)      -- cash_amount + franking_credits
);

CREATE INDEX IF NOT EXISTS idx_mart_tax_dividend_events_user_run ON mart_tax_dividend_events (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_tax_dividend_events_run_id   ON mart_tax_dividend_events (run_id);
CREATE INDEX IF NOT EXISTS idx_mart_tax_dividend_events_user_fy  ON mart_tax_dividend_events (user_id, financial_year);

ALTER TABLE mart_tax_dividend_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own dividend events"
    ON mart_tax_dividend_events FOR SELECT USING (auth.uid() = user_id);


-- ── mart_tax_remaining_parcels ────────────────────────────────────────────────
-- One row per parcel with remaining units after all disposals per run.
-- Written by: tax engine (tax_user_calc_dag).
-- Read by: Remaining Parcels report.

CREATE TABLE IF NOT EXISTS mart_tax_remaining_parcels (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    run_id      UUID        NOT NULL,
    run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    financial_year      TEXT    NOT NULL,
    parcel_id           TEXT,               -- activities.id of the BUY
    symbol              TEXT,
    acquired_date       DATE,
    original_quantity   NUMERIC(20, 6),
    remaining_quantity  NUMERIC(20, 6),
    remaining_cost_base NUMERIC(20, 2),
    unit_cost_base      NUMERIC(20, 6)
);

CREATE INDEX IF NOT EXISTS idx_mart_tax_remaining_parcels_user_run ON mart_tax_remaining_parcels (user_id, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_mart_tax_remaining_parcels_run_id   ON mart_tax_remaining_parcels (run_id);

ALTER TABLE mart_tax_remaining_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own remaining parcels"
    ON mart_tax_remaining_parcels FOR SELECT USING (auth.uid() = user_id);
