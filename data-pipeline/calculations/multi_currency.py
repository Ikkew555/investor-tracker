"""
Multi-currency calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  Three group_type rows per parcel/currency/country view.
  Returns rows ready for INSERT into mart_multi_currency.

Note: fx_gain is set to 0.0 because the FX rate at purchase time is not
stored in the current data model. When historical FX rates become available
(e.g. stored alongside activities), fx_gain can be computed as:
  fx_gain = local_qty × current_price × (current_fx_rate − buy_fx_rate)

mart_multi_currency columns:
  user_id, run_id, buy_id, symbol, currency, country,
  local_market_value, market_value_base, investment_gain,
  fx_gain, total_gain, group_type, group_value
"""

from calculations.fifo import match_all_disposals

# Future work: replace this with reliable metadata from the database or provider.
_COUNTRY_BY_EXCHANGE = {
    "ASX": "Australia", "XASX": "Australia",
    "NZX": "New Zealand", "XNZE": "New Zealand",
    "NMS": "United States", "NASDAQ": "United States", "NAS": "United States",
    "NYQ": "United States", "NYSE": "United States", "AMEX": "United States",
    "ARCX": "United States",
    "LSE": "United Kingdom", "XLON": "United Kingdom",
    "TSX": "Canada", "TSE": "Canada", "XTSE": "Canada",
    "HKEX": "Hong Kong", "HKG": "Hong Kong", "XHKG": "Hong Kong",
    "SGX": "Singapore", "XSES": "Singapore",
    "NSE": "India", "BSE": "India", "XNSE": "India",
    "TYO": "Japan", "TSEJ": "Japan", "XTKS": "Japan",
    "XETR": "Germany", "FRA": "Germany", "FWB": "Germany",
    "EPA": "France", "PAR": "France", "XPAR": "France",
    "SWX": "Switzerland", "SIX": "Switzerland", "XSWX": "Switzerland",
    "AMS": "Netherlands", "XAMS": "Netherlands",
    "STO": "Sweden", "XSTO": "Sweden",
    "OSL": "Norway", "XOSL": "Norway",
    "CPH": "Denmark", "XCSE": "Denmark",
}

_COUNTRY_BY_CURRENCY = {
    "AUD": "Australia",
    "USD": "United States",
    "NZD": "New Zealand",
    "GBP": "United Kingdom",
    "CAD": "Canada",
    "HKD": "Hong Kong",
    "SGD": "Singapore",
    "INR": "India",
    "JPY": "Japan",
    "EUR": "Eurozone",
    "CHF": "Switzerland",
    "SEK": "Sweden",
    "NOK": "Norway",
    "DKK": "Denmark",
}


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels    = inputs["parcels"]
    disposals  = inputs["disposals"]
    prices     = inputs["prices"]
    fx_rates   = inputs["fx_rates"]
    securities = inputs["securities"]

    remaining, _ = match_all_disposals(parcels, disposals)

    holding_rows = []

    # ── holding-level: one row per remaining parcel ────────────────────────────
    for p in parcels:
        qty_left = remaining[p["parcel_id"]]
        if qty_left <= 0:
            continue

        sym        = p["symbol"]
        price_data = prices.get(sym) or {}
        sec_data   = securities.get(sym) or {}
        currency   = (price_data.get("currency") or sec_data.get("currency") or "AUD").upper()
        exchange   = (sec_data.get("exchange") or "").upper()
        country    = (
            sec_data.get("country")
            or _COUNTRY_BY_EXCHANGE.get(exchange)
            or _COUNTRY_BY_CURRENCY.get(currency)
            or "Unknown"
        )

        fx          = fx_rates.get(currency, 1.0)
        cur_price   = float(price_data.get("regular_market_price") or 0)
        unit_cost   = (
            float(p["cost_base"]) / float(p["quantity"])
            if float(p["quantity"]) > 0 else 0.0
        )
        cost_parcel       = unit_cost * qty_left
        local_mv          = qty_left * cur_price
        mv_base           = local_mv * fx
        investment_gain   = mv_base - cost_parcel
        fx_gain           = 0.0  # no historical FX data
        total_gain        = investment_gain + fx_gain

        holding_rows.append({
            "user_id":            user_id,
            "run_id":             run_id,
            "buy_id":             p["parcel_id"],
            "symbol":             sym,
            "currency":           currency,
            "country":            country,
            "local_market_value": round(local_mv,        6),
            "market_value_base":  round(mv_base,         6),
            "investment_gain":    round(investment_gain, 6),
            "fx_gain":            round(fx_gain,         6),
            "total_gain":         round(total_gain,      6),
            "group_type":         "holding",
            "group_value":        sym,
        })

    total_mv = sum(r["market_value_base"] for r in holding_rows) or 1.0

    for r in holding_rows:
        r["weight_pct"] = round(r["market_value_base"] / total_mv * 100, 4)

    rows = list(holding_rows)

    # ── currency-level aggregation ─────────────────────────────────────────────
    by_currency: dict[str, dict] = {}
    for r in holding_rows:
        c = r["currency"]
        if c not in by_currency:
            by_currency[c] = {"local": 0.0, "base": 0.0, "inv": 0.0, "fx": 0.0, "total": 0.0}
        by_currency[c]["local"]  += r["local_market_value"]
        by_currency[c]["base"]   += r["market_value_base"]
        by_currency[c]["inv"]    += r["investment_gain"]
        by_currency[c]["fx"]     += r["fx_gain"]
        by_currency[c]["total"]  += r["total_gain"]

    for curr, agg in by_currency.items():
        rows.append({
            "user_id":            user_id,
            "run_id":             run_id,
            "buy_id":             None,
            "symbol":             None,
            "currency":           curr,
            "country":            None,
            "local_market_value": round(agg["local"],  6),
            "market_value_base":  round(agg["base"],   6),
            "investment_gain":    round(agg["inv"],    6),
            "fx_gain":            round(agg["fx"],     6),
            "total_gain":         round(agg["total"],  6),
            "group_type":         "currency",
            "group_value":        curr,
            "weight_pct":         round(agg["base"] / total_mv * 100, 4),
        })

    # ── country-level aggregation ──────────────────────────────────────────────
    by_country: dict[str, dict] = {}
    for r in holding_rows:
        c = r["country"]
        if c not in by_country:
            by_country[c] = {"local": 0.0, "base": 0.0, "inv": 0.0, "fx": 0.0, "total": 0.0}
        by_country[c]["local"]  += r["local_market_value"]
        by_country[c]["base"]   += r["market_value_base"]
        by_country[c]["inv"]    += r["investment_gain"]
        by_country[c]["fx"]     += r["fx_gain"]
        by_country[c]["total"]  += r["total_gain"]

    for country, agg in by_country.items():
        rows.append({
            "user_id":            user_id,
            "run_id":             run_id,
            "buy_id":             None,
            "symbol":             None,
            "currency":           None,
            "country":            country,
            "local_market_value": round(agg["local"],  6),
            "market_value_base":  round(agg["base"],   6),
            "investment_gain":    round(agg["inv"],    6),
            "fx_gain":            round(agg["fx"],     6),
            "total_gain":         round(agg["total"],  6),
            "group_type":         "country",
            "group_value":        country,
            "weight_pct":         round(agg["base"] / total_mv * 100, 4),
        })

    return rows
