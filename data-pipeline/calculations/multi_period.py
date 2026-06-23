"""
Multi-period performance calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  One row per time period (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL).
  Returns rows ready for INSERT into mart_multi_period.

Opening value approach: cost basis of parcels that were active at the start of
the period (after applying FIFO disposals that occurred before period_start).
This is a cost-basis proxy; a market-price-based opening value would require
storing historical price snapshots.

mart_multi_period columns:
  user_id, run_id, period_label, from_date, to_date,
  opening_value, closing_value, capital_gain,
  dividend_income, total_return, total_return_pct
"""

from datetime import datetime, timedelta, timezone

from calculations.fifo import match_all_disposals, apply_disposals_to_date

_PERIODS = [
    ("1M",  30),
    ("3M",  90),
    ("6M",  180),
    ("1Y",  365),
    ("3Y",  1095),
    ("5Y",  1825),
    ("ALL", None),
]

def _to_utc_dt(value):
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels   = inputs["parcels"]
    disposals = inputs["disposals"]
    dividends = inputs["dividends"]
    prices    = inputs["prices"]
    from_date = _to_utc_dt(inputs["from_date"])
    to_date = _to_utc_dt(inputs["to_date"])

    if not parcels:
        return []

    # Current closing value — same for all periods
    remaining_now, _ = match_all_disposals(parcels, disposals)
    closing_value = sum(
        remaining_now[p["parcel_id"]]
        * float((prices.get(p["symbol"]) or {}).get("regular_market_price") or 0)
        for p in parcels
        if remaining_now[p["parcel_id"]] > 0
    )

    today = datetime.now(timezone.utc)
    rows  = []

    for label, days in _PERIODS:
        period_start = today - timedelta(days=days) if days else from_date

        # Cost basis of parcels active at the start of the period
        remaining_at_start = apply_disposals_to_date(parcels, disposals, period_start)

        opening_value = sum(
            (float(p["cost_base"]) / float(p["quantity"]) if float(p["quantity"]) > 0 else 0.0)
            * remaining_at_start[p["parcel_id"]]
            for p in parcels
            if _to_utc_dt(p.get("acquired_date")) <= period_start
            and remaining_at_start[p["parcel_id"]] > 0
        )

        # Dividends paid within the period
        dividend_income = sum(
            float(div["cash_amount"])
            for div in dividends
            if _to_utc_dt(div.get("payment_date")) >= period_start
        )

        capital_gain = closing_value - opening_value
        total_return = capital_gain + dividend_income
        return_pct   = (total_return / opening_value * 100) if opening_value > 0 else 0.0

        rows.append({
            "user_id":          user_id,
            "run_id":           run_id,
            "period_label":     label,
            "from_date": period_start.date().isoformat(),
            "to_date": to_date.date().isoformat(),
            "opening_value":    round(opening_value,    6),
            "closing_value":    round(closing_value,    6),
            "capital_gain":     round(capital_gain,     6),
            "dividend_income":  round(dividend_income,  6),
            "total_return":     round(total_return,     6),
            "total_return_pct": round(return_pct,       4),
        })

    return rows
