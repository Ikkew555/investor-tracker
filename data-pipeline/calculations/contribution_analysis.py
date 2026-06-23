"""
Contribution analysis calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  Three group_type rows per symbol (holding / sector / asset_type).
  Returns rows ready for INSERT into mart_contribution_analysis.

mart_contribution_analysis columns:
  user_id, run_id, symbol, sector, asset_type, weight_pct,
  return_pct, contribution_pct, total_return,
  group_type, group_value
"""

from calculations.fifo import match_all_disposals

# metadata is blank. Future work: replace this with reliable provider/database
# metadata and remove the manual list.
_SECTOR_GROUPS = {
    "Financials": (
        "ANZ", "CBA", "NAB", "WBC", "MQG", "QBE", "SUN", "IAG", "ASX", "BEN", "BOQ",
        "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "V", "MA", "PYPL", "BRK.B",
    ),
    "Materials": (
        "BHP", "RIO", "FMG", "MIN", "NST", "NEM", "EVN", "S32", "LYC", "IGO", "NCM",
        "LIN", "APD", "SHW", "FCX", "NUE", "DD", "DOW", "VALE",
    ),
    "Health Care": (
        "CSL", "COH", "RMD", "SHL", "FPH", "PME", "ANN", "RHC",
        "JNJ", "PFE", "MRK", "UNH", "ABBV", "LLY", "TMO", "ABT", "DHR", "BMY", "AMGN", "GILD", "ISRG",
    ),
    "Communication Services": (
        "TLS", "TPG", "REA", "CAR", "SEK", "NEC", "HTA",
        "GOOG", "GOOGL", "META", "NFLX", "DIS", "T", "VZ", "CMCSA", "TMUS", "SPOT",
    ),
    "Consumer Staples": (
        "WES", "WOW", "COL", "MTS", "EDV", "TWE", "A2M", "ING",
        "WMT", "COST", "KO", "PEP", "PG", "MDLZ", "CL", "KMB", "MO", "PM",
    ),
    "Consumer Discretionary": (
        "JBH", "HVN", "WEB", "LOV", "SUL", "APE", "CTD", "FLT", "DMP",
        "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "GM", "F",
    ),
    "Energy": (
        "WDS", "STO", "ORG", "BPT", "WHC", "YAL",
        "XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX",
    ),
    "Industrials": (
        "TCL", "BXB", "AMC", "QAN", "ALQ", "AZJ", "AIA", "DOW",
        "BA", "CAT", "GE", "HON", "UPS", "UNP", "RTX", "LMT", "DE", "MMM", "ETN",
    ),
    "Information Technology": (
        "XRO", "WTC", "ALU", "CPU", "MP1", "NXT", "IRE", "DDR", "TNE",
        "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "ADBE", "CRM", "AMD", "INTC", "QCOM", "CSCO", "IBM", "NOW", "SNOW",
    ),
    "Real Estate": (
        "GMG", "SCG", "VCX", "CHC", "DXS", "MGR", "SGP", "GPT", "LLC",
        "AMT", "PLD", "O", "SPG", "EQIX", "PSA", "WELL", "DLR",
    ),
    "Utilities": (
        "AGL", "APA", "AST", "MEZ",
        "NEE", "DUK", "SO", "AEP", "SRE", "D", "EXC",
    ),
    "Diversified ETF": (
        "VAS", "A200", "IOZ", "STW", "VGS", "VEU", "VTS", "IVV", "VOO", "VTI", "SPY", "DIA", "IWM",
    ),
    "Technology ETF": (
        "NDQ", "QQQ", "HACK", "FANG", "TECH", "ARKK",
    ),
    "Income ETF": (
        "VHY", "IHD", "SYI", "SCHD", "VYM", "JEPI",
    ),
    "Fixed Income ETF": (
        "VAF", "VGB", "VBND", "IAF", "BOND", "AGG", "BND", "TLT", "IEF",
    ),
    "Gold/Commodity ETF": (
        "GOLD", "PMGOLD", "GLD", "IAU", "SLV",
    ),
    "Crypto": (
        "BTC", "ETH", "SOL", "ADA", "XRP", "DOGE",
    ),
}

_SECTOR_BY_SYMBOL = {
    symbol: sector
    for sector, symbols in _SECTOR_GROUPS.items()
    for symbol in symbols
}

_ASSET_TYPE_GROUPS = {
    "ETF": (
        "VAS", "A200", "IOZ", "STW", "VGS", "VEU", "VTS", "IVV", "VOO", "VTI", "SPY", "DIA", "IWM",
        "NDQ", "QQQ", "HACK", "FANG", "TECH", "ARKK", "VHY", "IHD", "SYI", "SCHD", "VYM", "JEPI",
        "VAF", "VGB", "VBND", "IAF", "BOND", "AGG", "BND", "TLT", "IEF", "GOLD", "PMGOLD", "GLD", "IAU", "SLV",
    ),
    "REIT": (
        "GMG", "SCG", "VCX", "CHC", "DXS", "MGR", "SGP", "GPT", "LLC",
        "AMT", "PLD", "O", "SPG", "EQIX", "PSA", "WELL", "DLR",
    ),
    "Crypto": (
        "BTC", "ETH", "SOL", "ADA", "XRP", "DOGE",
    ),
}

_ASSET_TYPE_BY_SYMBOL = {
    symbol: asset_type
    for asset_type, symbols in _ASSET_TYPE_GROUPS.items()
    for symbol in symbols
}


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels    = inputs["parcels"]
    disposals  = inputs["disposals"]
    prices     = inputs["prices"]
    securities = inputs["securities"]

    remaining, _ = match_all_disposals(parcels, disposals)

    # ── aggregate per symbol ───────────────────────────────────────────────────
    holdings: dict[str, dict] = {}
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
        meta  = securities.get(sym) or {}

        if sym not in holdings:
            holdings[sym] = {
                "cost_base":    0.0,
                "market_value": 0.0,
                "sector":     meta.get("sector")     or _SECTOR_BY_SYMBOL.get(sym)     or "Unknown",
                "asset_type": meta.get("asset_class") or _ASSET_TYPE_BY_SYMBOL.get(sym) or "Equity",
            }
        holdings[sym]["cost_base"]    += unit_cost * qty_left
        holdings[sym]["market_value"] += qty_left * price

    if not holdings:
        return []

    total_market_value = sum(h["market_value"] for h in holdings.values())
    rows = []

    # ── holding-level rows ─────────────────────────────────────────────────────
    for sym, h in holdings.items():
        mv   = h["market_value"]
        cb   = h["cost_base"]
        ret  = mv - cb
        w    = (mv / total_market_value * 100) if total_market_value > 0 else 0.0
        rp   = (ret / cb * 100)                if cb > 0             else 0.0
        cp   = w * rp / 100

        rows.append({
            "user_id":          user_id,
            "run_id":           run_id,
            "symbol":           sym,
            "sector":           h["sector"],
            "asset_type":       h["asset_type"],
            "weight_pct":       round(w,   4),
            "return_pct":       round(rp,  4),
            "contribution_pct": round(cp,  4),
            "total_return":     round(ret, 6),
            "group_type":       "holding",
            "group_value":      sym,
        })

    # ── sector-level rows ──────────────────────────────────────────────────────
    sector_agg: dict[str, dict] = {}
    for sym, h in holdings.items():
        s = h["sector"]
        if s not in sector_agg:
            sector_agg[s] = {"mv": 0.0, "cb": 0.0}
        sector_agg[s]["mv"] += h["market_value"]
        sector_agg[s]["cb"] += h["cost_base"]

    for sector, agg in sector_agg.items():
        mv  = agg["mv"]
        cb  = agg["cb"]
        ret = mv - cb
        w   = (mv / total_market_value * 100) if total_market_value > 0 else 0.0
        rp  = (ret / cb * 100)                if cb > 0             else 0.0
        cp  = w * rp / 100

        rows.append({
            "user_id":          user_id,
            "run_id":           run_id,
            "symbol":           None,
            "sector":           sector,
            "asset_type":       None,
            "weight_pct":       round(w,   4),
            "return_pct":       round(rp,  4),
            "contribution_pct": round(cp,  4),
            "total_return":     round(ret, 6),
            "group_type":       "sector",
            "group_value":      sector,
        })

    # ── asset-type-level rows ──────────────────────────────────────────────────
    asset_agg: dict[str, dict] = {}
    for sym, h in holdings.items():
        at = h["asset_type"]
        if at not in asset_agg:
            asset_agg[at] = {"mv": 0.0, "cb": 0.0}
        asset_agg[at]["mv"] += h["market_value"]
        asset_agg[at]["cb"] += h["cost_base"]

    for asset_type, agg in asset_agg.items():
        mv  = agg["mv"]
        cb  = agg["cb"]
        ret = mv - cb
        w   = (mv / total_market_value * 100) if total_market_value > 0 else 0.0
        rp  = (ret / cb * 100)                if cb > 0             else 0.0
        cp  = w * rp / 100

        rows.append({
            "user_id":          user_id,
            "run_id":           run_id,
            "symbol":           None,
            "sector":           None,
            "asset_type":       asset_type,
            "weight_pct":       round(w,   4),
            "return_pct":       round(rp,  4),
            "contribution_pct": round(cp,  4),
            "total_return":     round(ret, 6),
            "group_type":       "asset_type",
            "group_value":      asset_type,
        })

    return rows
