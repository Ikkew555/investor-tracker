"""
Sold securities calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  One row per SELL activity, FIFO-matched to buy parcels.
  Returns rows ready for INSERT into mart_sold_securities.

mart_sold_securities columns:
  user_id, run_id, sell_id, symbol, sell_date, quantity,
  gross_proceeds, broker_fees, net_proceeds, cost_base,
  realised_gain, holding_days, is_gain
"""

from calculations.fifo import match_all_disposals


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels   = inputs["parcels"]
    disposals = inputs["disposals"]

    if not disposals:
        return []

    _, matches = match_all_disposals(parcels, disposals)

    # Build a lookup for disposal metadata (gross_proceeds, brokerage, quantity)
    disposal_meta = {
        d["disposal_id"]: d for d in disposals
    }

    # Aggregate matched parcels back per disposal
    by_disposal: dict[str, dict] = {}
    for m in matches:
        did = m["disposal_id"]
        if did not in by_disposal:
            d = disposal_meta[did]
            by_disposal[did] = {
                "sell_id":              did,
                "symbol":               m["symbol"],
                "sell_date":            m["disposal_date"],
                "quantity":             float(d["quantity"]),
                "gross_proceeds":       float(d["gross_proceeds"]),
                "broker_fees":          float(d.get("brokerage") or 0),
                "cost_base":            0.0,
                "weighted_hold_days":   0.0,
            }
        by_disposal[did]["cost_base"]          += m["cost_base_matched"]
        by_disposal[did]["weighted_hold_days"] += m["holding_days"] * m["qty_matched"]

    rows = []
    for data in by_disposal.values():
        gross       = data["gross_proceeds"]
        fees        = data["broker_fees"]
        net         = gross - fees
        cost        = data["cost_base"]
        realised    = net - cost
        qty         = data["quantity"]
        holding_days = int(data["weighted_hold_days"] / qty) if qty > 0 else 0

        rows.append({
            "user_id":        user_id,
            "run_id":         run_id,
            "sell_id":        data["sell_id"],
            "symbol":         data["symbol"],
            "sell_date":      data["sell_date"],
            "quantity":       round(qty,      6),
            "gross_proceeds": round(gross,    6),
            "broker_fees":    round(fees,     6),
            "net_proceeds":   round(net,      6),
            "cost_base":      round(cost,     6),
            "realised_gain":  round(realised, 6),
            "holding_days":   holding_days,
            "is_gain":        realised >= 0,
        })

    return rows
