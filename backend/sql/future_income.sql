SELECT
    fi.user_id,
    fi.run_id,
    fi.symbol,
    fi.quantity,
    fi.annual_dps,
    fi.annual_income,
    fi.yield_pct,
    fi.last_payment_date,
    fi.last_payment_amount,
    s.name AS security_name
FROM mart_future_income fi
LEFT JOIN securities s ON s.symbol = fi.symbol
WHERE fi.user_id = :user_id
  AND fi.run_id = (
      SELECT run_id FROM mart_future_income
      WHERE user_id = :user_id
      ORDER BY run_id DESC
      LIMIT 1
  )
ORDER BY fi.annual_income DESC;
