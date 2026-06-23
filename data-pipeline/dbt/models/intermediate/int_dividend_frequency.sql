-- Infers the historical dividend payment frequency per symbol.
-- Uses the gap between consecutive ex_dates to compute an average inter-payment interval.
-- Output is joined by int_upcoming_dividends to project the next payment date.
{{ config(materialized='table') }}

WITH gaps AS (
    SELECT
        symbol,
        ex_date,
        LAG(ex_date) OVER (
            PARTITION BY symbol
            ORDER BY ex_date
        )                                                   AS prev_ex_date,
        ex_date - LAG(ex_date) OVER (
            PARTITION BY symbol
            ORDER BY ex_date
        )                                                   AS gap_days
    FROM {{ ref('stg_dividend_data') }}
    WHERE ex_date IS NOT NULL
)

SELECT
    symbol,
    ROUND(AVG(gap_days), 0)::INT                        AS avg_gap_days,
    COUNT(*)                                            AS payment_count,
    CASE
        WHEN ROUND(AVG(gap_days), 0) <= 45  THEN 'monthly'
        WHEN ROUND(AVG(gap_days), 0) <= 120 THEN 'quarterly'
        WHEN ROUND(AVG(gap_days), 0) <= 220 THEN 'semi_annual'
        ELSE 'annual'
    END                                                 AS frequency_label
FROM gaps
WHERE gap_days IS NOT NULL
  AND gap_days > 0
GROUP BY symbol
