SELECT
    ss.user_id,
    ss.run_id,
    ss.sell_id,
    ss.symbol,
    ss.sell_date,
    ss.quantity,
    ss.gross_proceeds,
    ss.broker_fees,
    ss.net_proceeds,
    ss.cost_base,
    ss.realised_gain,
    ss.holding_days,
    ss.is_gain,
    s.name AS security_name
FROM mart_sold_securities ss
LEFT JOIN securities s ON s.symbol = ss.symbol
WHERE ss.user_id = :user_id
  AND ss.run_id = (
      SELECT run_id FROM mart_sold_securities
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY ss.sell_date DESC;
