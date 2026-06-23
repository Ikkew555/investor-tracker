SELECT
    ce.user_id,
    ce.run_id,
    ce.event_date,
    ce.symbol,
    ce.event_type,
    ce.projected_amount,
    ce.frequency_days,
    ce.anchor_date,
    ce.horizon_date,
    s.name AS security_name
FROM mart_calendar_events ce
LEFT JOIN securities s ON s.symbol = ce.symbol
WHERE ce.user_id = :user_id
  AND ce.run_id = (
      SELECT run_id FROM mart_calendar_events
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY ce.event_date ASC;
