-- Staging: clean activities
-- Materialized as a VIEW so CREATE OR REPLACE VIEW is used — no backup table
-- is ever created, making concurrent DAG runs safe.
{{ config(materialized='view') }}

select
    id,
    user_id,
    security_id,
    broker_id,
    upper(type)                                          as type,
    date,
    round(cast(quantity     as numeric), 6)              as quantity,
    round(cast(price        as numeric), 6)              as price,
    round(cast(total_amount as numeric), 6)              as total_amount,
    round(coalesce(cast(fees as numeric), 0), 6)         as fees,
    round(coalesce(cast(franking_percent as numeric), 0), 6) as franking_percent,
    round(coalesce(cast(franking_credits as numeric), 0), 6) as franking_credits,
    currency,
    notes
from {{ source('nexgen', 'activities') }}
where user_id is not null
  and type is not null
  and (total_amount is not null or upper(type) = 'BUY')
  {% if var('user_id', '') != '' %}
  and user_id = '{{ var("user_id") }}'
  {% endif %}
order by date asc