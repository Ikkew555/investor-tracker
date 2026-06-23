"""
Future income calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  One row per currently held symbol, projecting annual dividend income.
  Returns rows ready for INSERT into mart_future_income.

mart_future_income columns:
  user_id, run_id, symbol, quantity, annual_dps, annual_income,
  yield_pct, last_payment_date, last_payment_amount
"""

from calculations.fifo import match_all_disposals


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels   = inputs["parcels"]
    disposals = inputs["disposals"]
    dividends = inputs["dividends"]
    prices    = inputs["prices"]

    remaining, _ = match_all_disposals(parcels, disposals)

    # Current holdings per symbol
    holdings: dict[str, float] = {}
    for p in parcels:
        qty_left = remaining[p["parcel_id"]]
        if qty_left > 0:
            holdings[p["symbol"]] = holdings.get(p["symbol"], 0.0) + qty_left

    # Most recent dividend payment per symbol
    last_div: dict[str, dict] = {}
    for div in sorted(dividends, key=lambda d: d["payment_date"]):
        last_div[div["symbol"]] = {
            "date":   div["payment_date"],
            "amount": float(div["cash_amount"]),
        }

    rows = []
    for sym, qty in holdings.items():
        if qty <= 0:
            continue

        price_data    = prices.get(sym) or {}
        current_price = float(price_data.get("regular_market_price") or 0)
        annual_dps    = float(price_data.get("dividend_rate") or 0)
        annual_income = qty * annual_dps
        market_value  = qty * current_price
        yield_pct     = (annual_income / market_value * 100) if market_value > 0 else 0.0

        div_info = last_div.get(sym, {})

        rows.append({
            "user_id":             user_id,
            "run_id":              run_id,
            "symbol":              sym,
            "quantity":            round(qty,          6),
            "annual_dps":          round(annual_dps,   6),
            "annual_income":       round(annual_income, 6),
            "yield_pct":           round(yield_pct,    4),
            "last_payment_date":   div_info.get("date"),
            "last_payment_amount": round(div_info.get("amount", 0.0), 6),
        })

    return rows
