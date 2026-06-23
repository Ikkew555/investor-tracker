SELECT
    ca.user_id,
    ca.run_id,
    ca.symbol,
    ca.sector,
    ca.asset_type,
    ca.weight_pct,
    ca.return_pct,
    ca.contribution_pct,
    ca.total_return,
    ca.group_type,
    ca.group_value,
    s.name AS security_name
FROM mart_contribution_analysis ca
LEFT JOIN securities s ON s.symbol = ca.symbol
WHERE ca.user_id = :user_id
  AND ca.run_id = (
      SELECT run_id FROM mart_contribution_analysis
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY ca.group_type, ca.contribution_pct DESC;
