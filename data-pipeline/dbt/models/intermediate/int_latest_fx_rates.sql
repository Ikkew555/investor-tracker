-- Intermediate: one row per currency pair with the most recently fetched rate.
-- Used by calculations/main.py to load fx_rates dict for multi_currency calcs.

select distinct on (from_currency, to_currency)
    from_currency,
    to_currency,
    rate,
    fetched_at
from {{ ref('stg_fx_rates') }}
order by from_currency, to_currency, fetched_at desc
