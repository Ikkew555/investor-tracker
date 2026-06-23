SELECT
    p.user_id,
    p.run_id,
    p.from_date,
    p.to_date,
    p.symbol,
    p.quantity,
    p.cost_base,
    p.market_value,
    p.capital_gain,
    p.dividend_income,
    p.total_return,
    p.total_return_pct,
    p.opening_value,
    p.closing_value,
    s.name AS security_name,
    m.regular_market_price AS last_price,
    m.currency
FROM mart_performance p
LEFT JOIN securities s ON s.symbol = p.symbol
LEFT JOIN int_latest_prices m ON m.symbol = p.symbol
WHERE p.user_id = :user_id
  AND p.run_id = (
      SELECT run_id FROM mart_performance
      WHERE user_id = :user_id
      ORDER BY to_date DESC
      LIMIT 1
  )
ORDER BY p.symbol;
