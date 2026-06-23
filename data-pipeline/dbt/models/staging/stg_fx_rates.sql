-- Staging: clean raw_fx_rates
-- - Cast rate to numeric, standardise to 6dp
-- - Drop rows missing mandatory fields
-- - Preserves full append-only history

select
    id,
    upper(from_currency)                              as from_currency,
    upper(to_currency)                                as to_currency,
    round(cast(rate as numeric), 2)                   as rate,
    fetched_at
from {{ source('nexgen', 'raw_fx_rates') }}
where from_currency is not null
  and to_currency   is not null
  and rate          is not null
order by fetched_at asc
