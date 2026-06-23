-- Intermediate: one row per BUY activity, shaped as a parcel for the calc engine.
-- cost_base = qty × price + fees (total acquisition cost).
-- VIEW so concurrent DAG runs never conflict on int_parcels__dbt_backup.
{{ config(materialized='view') }}

select
    a.id                                                      as parcel_id,
    a.user_id,
    a.security_id,
    s.symbol,
    a.date                                                    as acquired_date,
    a.quantity,
    (a.quantity * a.price + a.fees)                          as cost_base
from {{ ref('stg_activities') }} a
join {{ source('nexgen', 'securities') }} s
    on s.id = a.security_id
where a.type = 'BUY'
  and a.quantity > 0
  {% if var('user_id', '') != '' %}
  and a.user_id = '{{ var("user_id") }}'
  {% endif %}
order by a.user_id, a.date asc
