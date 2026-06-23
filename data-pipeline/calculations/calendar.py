"""
Calendar events calculation module.

calculate(user_id, run_id, inputs) -> list[dict]
  Projects future dividend payments 12 months forward for each currently held
  security that has a dividend payment history.
  Returns rows ready for INSERT into mart_calendar_events.

Frequency inference (from gap between payment dates):
  ≤ 45 days  → monthly  (30)
  ≤ 120 days → quarterly (90)
  ≤ 220 days → semi-annual (180)
  else       → annual (365)

mart_calendar_events columns:
  user_id, run_id, event_date, symbol, event_type,
  projected_amount, frequency_days, anchor_date, horizon_date
"""

from collections import defaultdict
from datetime import datetime, timedelta

from calculations.fifo import match_all_disposals


def _to_date(s):
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
        return dt.date()
    except Exception:
        return None


def _infer_frequency(payment_dates: list) -> int:
    if len(payment_dates) < 2:
        return 365
    sorted_dates = sorted(payment_dates)
    gaps = [(sorted_dates[i + 1] - sorted_dates[i]).days for i in range(len(sorted_dates) - 1)]
    avg  = sum(gaps) / len(gaps)
    if avg <= 45:
        return 30
    if avg <= 120:
        return 90
    if avg <= 220:
        return 180
    return 365


def calculate(user_id: str, run_id: str, inputs: dict) -> list[dict]:
    parcels   = inputs["parcels"]
    disposals = inputs["disposals"]
    dividends = inputs["dividends"]

    remaining, _ = match_all_disposals(parcels, disposals)

    # Current holdings
    holdings: dict[str, float] = {}
    for p in parcels:
        qty_left = remaining[p["parcel_id"]]
        if qty_left > 0:
            holdings[p["symbol"]] = holdings.get(p["symbol"], 0.0) + qty_left

    # Dividend history per symbol
    div_by_sym: dict[str, list] = defaultdict(list)
    for div in dividends:
        d = _to_date(div["payment_date"])
        if d:
            div_by_sym[div["symbol"]].append({
                "date":   d,
                "amount": float(div["cash_amount"]),
            })

    today   = datetime.utcnow().date()
    horizon = today + timedelta(days=365)
    rows    = []

    for sym in holdings:
        divs = sorted(div_by_sym.get(sym, []), key=lambda x: x["date"])
        if not divs:
            continue  # no dividend history — skip projection

        last       = divs[-1]
        freq       = _infer_frequency([d["date"] for d in divs])
        # trailing average of up to last 4 payments
        recent_amt = sum(d["amount"] for d in divs[-4:]) / min(4, len(divs))

        anchor      = last["date"]
        next_event  = anchor + timedelta(days=freq)

        while next_event <= horizon:
            rows.append({
                "user_id":          user_id,
                "run_id":           run_id,
                "event_date":       next_event.isoformat(),
                "symbol":           sym,
                "event_type":       "DIVIDEND",
                "projected_amount": round(recent_amt, 6),
                "frequency_days":   freq,
                "anchor_date":      anchor.isoformat(),
                "horizon_date":     horizon.isoformat(),
            })
            next_event += timedelta(days=freq)

    return rows
