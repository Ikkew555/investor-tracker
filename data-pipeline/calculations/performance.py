"""
Performance calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  Pure function — no DB calls. Called by calculations/main.py.
  Returns rows ready for INSERT into mart_performance.

mart_performance columns:
  user_id, run_id, from_date, to_date, symbol, quantity, cost_base,
  market_price, market_value, capital_gain, unrealised_gain, realised_gain,
  dividend_income, total_return, total_return_pct, opening_value, closing_value
"""

from datetime import datetime

from calculations.fifo import match_all_disposals


def _parse_date(s) -> datetime:
    return datetime.strptime(str(s)[:10], "%Y-%m-%d")


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels   = inputs["parcels"]
    disposals = inputs["disposals"]
    dividends = inputs["dividends"]
    prices    = inputs["prices"]
    from_date = inputs["from_date"]
    to_date   = inputs["to_date"]

    if not parcels:
        return []

    from_dt = _parse_date(from_date)
    to_dt   = _parse_date(to_date)

    # Only consider disposals and dividends within the requested date range
    ranged_disposals = [
        d for d in disposals
        if from_dt <= _parse_date(d["disposal_date"]) <= to_dt
    ]
    ranged_dividends = [
        d for d in dividends
        if from_dt <= _parse_date(d["payment_date"]) <= to_dt
    ]

    remaining, matches = match_all_disposals(parcels, ranged_disposals)

    # ── per-symbol aggregates from remaining parcels ───────────────────────────
    result: dict[str, dict] = {}

    for p in parcels:
        sym      = p["symbol"]
        qty_left = remaining[p["parcel_id"]]
        if qty_left <= 0:
            continue

        unit_cost = (
            float(p["cost_base"]) / float(p["quantity"])
            if float(p["quantity"]) > 0 else 0.0
        )
        price = float((prices.get(sym) or {}).get("regular_market_price") or 0)

        if sym not in result:
            result[sym] = {
                "quantity":     0.0,
                "cost_base":    0.0,
                "market_price": price,
                "market_value": 0.0,
                "realised":     0.0,
                "dividends":    0.0,
            }
        result[sym]["quantity"]     += qty_left
        result[sym]["cost_base"]    += unit_cost * qty_left
        result[sym]["market_value"] += qty_left * price

    # ── realised gains from disposed parcels (within date range) ──────────────
    for m in matches:
        sym = m["symbol"]
        if sym in result:
            result[sym]["realised"] += m["realised_gain"]

    # ── dividend income (within date range) ───────────────────────────────────
    for div in ranged_dividends:
        sym = div["symbol"]
        if sym in result:
            result[sym]["dividends"] += float(div["cash_amount"])

    # ── build mart rows ────────────────────────────────────────────────────────
    rows = []
    for sym, data in result.items():
        cost_base       = data["cost_base"]
        market_value    = data["market_value"]
        unrealised_gain = market_value - cost_base
        realised_gain   = data["realised"]
        capital_gain    = unrealised_gain + realised_gain
        dividend_income = data["dividends"]
        total_return    = capital_gain + dividend_income
        return_pct      = (total_return / cost_base * 100) if cost_base > 0 else 0.0

        rows.append({
            "user_id":          user_id,
            "run_id":           run_id,
            "from_date":        from_date,
            "to_date":          to_date,
            "symbol":           sym,
            "quantity":         round(data["quantity"],      6),
            "cost_base":        round(cost_base,             6),
            "market_price":     round(data["market_price"],  6),
            "market_value":     round(market_value,          6),
            "capital_gain":     round(capital_gain,          6),
            "unrealised_gain":  round(unrealised_gain,       6),
            "realised_gain":    round(realised_gain,         6),
            "dividend_income":  round(dividend_income,       6),
            "total_return":     round(total_return,          6),
            "total_return_pct": round(return_pct,            4),
            "opening_value":    round(cost_base,             6),
            "closing_value":    round(market_value,          6),
        })

    return rows
