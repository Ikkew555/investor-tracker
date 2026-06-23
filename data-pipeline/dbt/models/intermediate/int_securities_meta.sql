-- Intermediate: symbol metadata for enrichment in the calc engine and API layer.
-- Materialized as a VIEW (not a table) so that:
--   1. No dbt backup table is created during refresh → eliminates the race condition
--      when tax_user_calc_dag and market_user_calc_dag run dbt simultaneously.
--   2. Always reflects the latest securities data without needing an explicit rebuild.
--   3. CREATE OR REPLACE VIEW is idempotent — safe to run from multiple concurrent DAGs.

{{ config(materialized='view') }}

select
    symbol,
    name,
    asset_class,
    sector,
    country,
    exchange,
    currency
from {{ source('nexgen', 'securities') }}
where symbol is not null
