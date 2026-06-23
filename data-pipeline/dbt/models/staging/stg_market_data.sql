-- Staging: clean raw_market_data
-- Casts types, standardises to 6dp, preserves full append-only time-series.
-- Renamed from stg_market_data so the purpose is explicit.

select
    id,
    symbol,
    exchange,
    currency,
    round(cast(regular_market_price as numeric), 2) as regular_market_price,
    round(cast(open                 as numeric), 2) as open,
    round(cast(close                as numeric), 2) as close,
    -- Yahoo Finance v10/v7 often returns NULL for dividend_rate on ASX stocks.
    -- last_dividend_value (from the v8/chart API) is reliably populated.
    -- Use it as a fallback so int_latest_prices.dividend_rate is non-null for
    -- any stock that has paid a dividend, letting the dividend DAG find them.
    round(cast(coalesce(dividend_rate, last_dividend_value) as numeric), 2) as dividend_rate,
    sector,
    industry,
    fetched_at,
    created_at
from {{ source('nexgen', 'raw_market_data') }}
where symbol is not null
order by fetched_at asc
