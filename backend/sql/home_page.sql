SELECT
    p.user_id,
    p.run_id,
    SUM(p.market_value)      AS total_market_value,
    SUM(p.cost_base)         AS total_cost_base,
    SUM(p.capital_gain)      AS total_capital_gain,
    SUM(p.dividend_income)   AS total_dividend_income,
    SUM(p.total_return)      AS total_return,
    CASE
        WHEN SUM(p.cost_base) > 0
        THEN ROUND(SUM(p.total_return) / SUM(p.cost_base) * 100, 4)
        ELSE 0
    END AS total_return_pct,
    p.to_date AS as_of_date
FROM mart_performance p
WHERE p.user_id = :user_id
  AND p.run_id = (
      SELECT run_id FROM mart_performance
      WHERE user_id = :user_id
      ORDER BY to_date DESC
      LIMIT 1
  )
GROUP BY p.user_id, p.run_id, p.to_date;
