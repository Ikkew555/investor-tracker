-- Intermediate: one row per SELL activity, shaped as a disposal for the calc engine.
-- VIEW so concurrent DAG runs never conflict on int_disposals__dbt_backup.
{{ config(materialized='view') }}

select
    a.id                  as disposal_id,
    a.user_id,
    s.symbol,
    a.date                as disposal_date,
    a.quantity,
    a.total_amount        as gross_proceeds,
    a.fees                as brokerage
from {{ ref('stg_activities') }} a
join {{ source('nexgen', 'securities') }} s
    on s.id = a.security_id
where a.type = 'SELL'
  and a.quantity > 0
  {% if var('user_id', '') != '' %}
  and a.user_id = '{{ var("user_id") }}'
  {% endif %}
order by a.user_id, a.date asc
