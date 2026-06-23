SELECT
    mc.user_id,
    mc.run_id,
    mc.buy_id,
    mc.symbol,
    mc.currency,
    mc.country,
    mc.local_market_value,
    mc.market_value_base,
    mc.investment_gain,
    mc.fx_gain,
    mc.total_gain,
    mc.group_type,
    mc.group_value,
    s.name AS security_name
FROM mart_multi_currency mc
LEFT JOIN securities s ON s.symbol = mc.symbol
WHERE mc.user_id = :user_id
  AND mc.run_id = (
      SELECT run_id FROM mart_multi_currency
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY mc.group_type, mc.total_gain DESC;
