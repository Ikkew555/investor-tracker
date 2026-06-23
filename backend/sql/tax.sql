SELECT
    te.user_id,
    te.run_id,
    te.financial_year,
    te.entity_type,
    te.symbol,
    te.sell_id,
    te.buy_id,
    te.acquired_date,
    te.sell_date,
    te.holding_days,
    te.cgt_method,
    te.raw_gain,
    te.discount_applied,
    te.net_gain,
    te.capital_loss,
    te.franking_credits,
    te.grossed_up_dividend,
    s.name AS security_name
FROM mart_tax_events te
LEFT JOIN securities s ON s.symbol = te.symbol
WHERE te.user_id = :user_id
  AND te.run_id = (
      SELECT run_id FROM mart_tax_events
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY te.financial_year DESC, te.sell_date DESC;
