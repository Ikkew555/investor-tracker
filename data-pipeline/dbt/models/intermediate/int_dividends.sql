-- Intermediate: one row per DIVIDEND activity, shaped for the calc engine.
-- VIEW so concurrent DAG runs never conflict on int_dividends__dbt_backup.
{{ config(materialized='view') }}

select
    a.id              as dividend_id,
    a.user_id,
    s.symbol,
    a.date            as payment_date,
    a.total_amount    as cash_amount,
    a.franking_percent,
    a.franking_credits
from {{ ref('stg_activities') }} a
join {{ source('nexgen', 'securities') }} s
    on s.id = a.security_id
where a.type = 'DIVIDEND'
  {% if var('user_id', '') != '' %}
  and a.user_id = '{{ var("user_id") }}'
  {% endif %}
order by a.user_id, a.date asc
