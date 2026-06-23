SELECT
    mp.user_id,
    mp.run_id,
    mp.period_label,
    mp.from_date,
    mp.to_date,
    mp.opening_value,
    mp.closing_value,
    mp.capital_gain,
    mp.dividend_income,
    mp.total_return,
    mp.total_return_pct
FROM mart_multi_period mp
WHERE mp.user_id = :user_id
  AND mp.run_id = (
      SELECT run_id FROM mart_multi_period
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY mp.from_date ASC;
