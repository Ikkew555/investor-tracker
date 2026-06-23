-- Staging model for raw_dividend_data.
-- Cleans and casts the raw dividend announcements inserted by scheduled_dividend_franking_dag.
-- Output is consumed by int_dividend_frequency and int_upcoming_dividends.

WITH source AS (
    SELECT * FROM {{ source('nexgen', 'raw_dividend_data') }}
),

cleaned AS (
    SELECT
        id,
        UPPER(TRIM(symbol))                         AS symbol,
        CAST(ex_date       AS DATE)                 AS ex_date,
        CAST(payment_date  AS DATE)                 AS payment_date,
        ROUND(CAST(amount AS NUMERIC), 6)           AS amount,
        LOWER(COALESCE(dividend_type, 'regular'))   AS dividend_type,
        -- Default franking to 100% for ASX stocks when not explicitly set;
        -- downstream: override with actual ASX announcement data if available.
        COALESCE(CAST(franking_pct AS NUMERIC), 100.0)  AS franking_pct,
        UPPER(TRIM(COALESCE(currency, 'AUD')))      AS currency,
        COALESCE(source, 'yahoo_finance')           AS source,
        fetched_at
    FROM source
    WHERE amount IS NOT NULL
      AND CAST(amount AS NUMERIC) > 0
      AND symbol IS NOT NULL
)

SELECT * FROM cleaned
