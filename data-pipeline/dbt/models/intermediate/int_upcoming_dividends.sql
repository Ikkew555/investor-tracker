-- Produces one row per symbol: the most recent dividend record plus
-- a projected next ex_date based on the historical payment frequency.
-- Consumed by: future_income (Group C) and calendar (Group D) calculation engines
-- via calculations/main.py _load_inputs().

WITH latest AS (
    -- Most recent announced dividend per symbol
    SELECT DISTINCT ON (symbol)
        symbol,
        ex_date,
        payment_date,
        amount                  AS dividend_per_unit,
        dividend_type,
        franking_pct,
        currency,
        source,
        fetched_at
    FROM {{ ref('stg_dividend_data') }}
    WHERE ex_date IS NOT NULL
    ORDER BY symbol, ex_date DESC, fetched_at DESC
),

with_frequency AS (
    SELECT
        l.symbol,
        l.ex_date               AS last_ex_date,
        l.payment_date          AS last_payment_date,
        l.dividend_per_unit,
        l.dividend_type,
        l.franking_pct,
        l.currency,
        l.source,
        l.fetched_at,
        COALESCE(f.avg_gap_days, 365)   AS avg_gap_days,
        COALESCE(f.frequency_label, 'annual') AS frequency_label,
        COALESCE(f.payment_count, 1)    AS payment_count
    FROM latest l
    LEFT JOIN {{ ref('int_dividend_frequency') }} f
        ON f.symbol = l.symbol
),

projected AS (
    SELECT
        symbol,
        last_ex_date,
        last_payment_date,
        dividend_per_unit,
        dividend_type,
        franking_pct,
        currency,
        source,
        avg_gap_days,
        frequency_label,
        payment_count,
        -- Project next ex_date by adding one frequency interval to the last known ex_date
        (last_ex_date + (avg_gap_days || ' days')::INTERVAL)::DATE  AS projected_next_ex_date,
        -- Annualised dividend per unit: DPU × number of payments per year
        ROUND(
            dividend_per_unit * (365.0 / NULLIF(avg_gap_days, 0)),
            6
        )                                                            AS annual_dps
    FROM with_frequency
)

SELECT * FROM projected
-- Only surface rows where the projected next payment is in the future or within last 30 days
WHERE projected_next_ex_date >= CURRENT_DATE - INTERVAL '30 days'
