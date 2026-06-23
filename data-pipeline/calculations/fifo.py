"""
Shared FIFO utilities used by all calculation modules.

Core operation: match SELL disposals against BUY parcels oldest-first and track
remaining quantities. All modules import from here so the matching logic stays
in one place.
"""
from datetime import datetime, timezone, date as _date_type


def _parse_dt(s) -> datetime:
    if isinstance(s, datetime):
        dt = s

    elif isinstance(s, _date_type):
        dt = datetime(s.year, s.month, s.day)

    else:
        try:
            dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        except (ValueError, TypeError, AttributeError):
            return datetime.min.replace(tzinfo=timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def days_between(d1, d2) -> int:
    try:
        return abs((_parse_dt(d2) - _parse_dt(d1)).days)
    except Exception:
        return 0


def match_all_disposals(
    parcels: list[dict],
    disposals: list[dict],
) -> tuple[dict, list[dict]]:
    """
    FIFO-match every disposal against buy parcels (oldest parcel first).

    Returns
    -------
    remaining : dict[parcel_id -> float]
        Quantity of each parcel still held after all disposals.
    matches : list[dict]
        One entry per parcel consumed by a disposal:
          disposal_id, parcel_id (= buy_id), sell_id, symbol,
          acquired_date, disposal_date, qty_matched,
          unit_cost, cost_base_matched, net_proceeds_attributed,
          realised_gain, holding_days
    """
    parcels_by_sym: dict[str, list] = {}
    for p in sorted(parcels, key=lambda x: _parse_dt(x["acquired_date"])):
        parcels_by_sym.setdefault(p["symbol"], []).append(p)

    remaining = {p["parcel_id"]: float(p["quantity"]) for p in parcels}
    unit_cost = {
        p["parcel_id"]: float(p["cost_base"]) / float(p["quantity"])
        if float(p["quantity"]) > 0 else 0.0
        for p in parcels
    }

    matches: list[dict] = []

    for d in sorted(disposals, key=lambda x: _parse_dt(x["disposal_date"])):
        sym = d["symbol"]
        total_qty = float(d["quantity"])
        gross = float(d["gross_proceeds"])
        brokerage = float(d.get("brokerage") or 0)
        qty_left = total_qty

        for p in parcels_by_sym.get(sym, []):
            if qty_left <= 0:
                break
            if remaining[p["parcel_id"]] <= 0:
                continue

            take = min(remaining[p["parcel_id"]], qty_left)
            weight = take / total_qty if total_qty > 0 else 0.0
            cost_matched = unit_cost[p["parcel_id"]] * take
            net_proceeds = (gross - brokerage) * weight

            matches.append({
                "disposal_id":           d["disposal_id"],
                "parcel_id":             p["parcel_id"],
                "buy_id":                p["parcel_id"],
                "sell_id":               d["disposal_id"],
                "symbol":                sym,
                "acquired_date":         p["acquired_date"],
                "disposal_date":         d["disposal_date"],
                "qty_matched":           take,
                "unit_cost":             unit_cost[p["parcel_id"]],
                "cost_base_matched":     cost_matched,
                "net_proceeds_attributed": net_proceeds,
                "realised_gain":         net_proceeds - cost_matched,
                "holding_days":          days_between(p["acquired_date"], d["disposal_date"]),
            })

            remaining[p["parcel_id"]] -= take
            qty_left -= take

    return remaining, matches


def apply_disposals_to_date(
    parcels: list[dict],
    disposals: list[dict],
    before_date,
) -> dict:
    """
    Apply only disposals whose disposal_date is strictly BEFORE before_date.
    Returns remaining quantity per parcel_id (used by multi_period for opening values).
    """
    parcels_by_sym: dict[str, list] = {}
    for p in sorted(parcels, key=lambda x: _parse_dt(x["acquired_date"])):
        parcels_by_sym.setdefault(p["symbol"], []).append(p)

    remaining = {p["parcel_id"]: float(p["quantity"]) for p in parcels}
    cutoff = _parse_dt(before_date)

    for d in sorted(disposals, key=lambda x: _parse_dt(x["disposal_date"])):
        if _parse_dt(d["disposal_date"]) >= cutoff:
            continue
        sym = d["symbol"]
        qty_left = float(d["quantity"])
        for p in parcels_by_sym.get(sym, []):
            if qty_left <= 0:
                break
            if remaining[p["parcel_id"]] <= 0:
                continue
            take = min(remaining[p["parcel_id"]], qty_left)
            remaining[p["parcel_id"]] -= take
            qty_left -= take

    return remaining
