-- Intermediate: one row per symbol with the most recently fetched price.
-- Read by calculations/performance.py to build current_prices for the calc engine.

select distinct on (symbol)
    symbol,
    exchange,
    currency,
    regular_market_price,
    open,
    close,
    dividend_rate,
    sector,
    industry,
    fetched_at
from {{ ref('stg_market_data') }}
order by symbol, fetched_at desc