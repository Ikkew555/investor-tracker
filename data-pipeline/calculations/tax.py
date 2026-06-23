"""
Tax calculation — wraps tax_engine.calculate() for the Airflow pipeline.

Returns a dict of {table_name: [rows]} for 4 mart tables:
  mart_tax_summary           — one row per FY per run
  mart_tax_cgt_events        — one row per BUY×SELL parcel match per FY
  mart_tax_dividend_events   — one row per dividend payment per FY
  mart_tax_remaining_parcels — one row per parcel with remaining units (current state)

WHY multi-FY: the engine filters events by a single financial_year. Calling it
once with _current_fy() would discard all historical data. Instead we discover
every FY in the data and run the engine once per FY — FIFO matching is always
done over all disposals chronologically, so per-FY summaries are correct and
there is no double-counting.

Remaining parcels are identical across all FY runs (all disposals are always
processed in full). We use the last run's remaining parcels so we only insert
one set.
"""

from datetime import datetime, timezone

from calculations.tax_engine import (
    calculate as _engine_calculate,
    to_mart_tax_rows,
    to_fy as _to_fy,
)

# user_settings.entity_type uses "smsf"; the engine uses "super"
_ENTITY_MAP = {"smsf": "super"}


def _current_fy() -> str:
    today = datetime.now(timezone.utc)
    return f"FY{today.year + 1}" if today.month >= 7 else f"FY{today.year}"


def calculate(user_id: str, run_id: str, inputs: dict) -> dict[str, list[dict]]:
    entity_type = _ENTITY_MAP.get(
        (inputs.get("entity_type") or "individual").lower(),
        (inputs.get("entity_type") or "individual").lower(),
    )

    parcels = [
        {
            "parcel_id":     str(p["parcel_id"]),
            "symbol":        p["symbol"],
            "acquired_date": str(p["acquired_date"]),
            "quantity":      float(p["quantity"]),
            "cost_base":     float(p["cost_base"] or 0),
        }
        for p in inputs["parcels"]
        if p.get("quantity") and p.get("cost_base") is not None
    ]

    disposals = [
        {
            "disposal_id":    str(d["disposal_id"]),
            "symbol":         d["symbol"],
            "disposal_date":  str(d["disposal_date"]),
            "quantity":       float(d["quantity"]),
            "gross_proceeds": float(d.get("gross_proceeds") or 0),
            "brokerage":      float(d.get("brokerage") or 0),
        }
        for d in inputs["disposals"]
        if d.get("quantity")
    ]

    dividends = [
        {
            "dividend_id":      str(d["dividend_id"]),
            "symbol":           d["symbol"],
            "payment_date":     str(d["payment_date"]),
            "cash_amount":      float(d.get("cash_amount") or 0),
            "franking_percent": float(d.get("franking_percent") or 0),
            "franking_credits": float(d.get("franking_credits") or 0),
        }
        for d in inputs["dividends"]
        if d.get("cash_amount") is not None
    ]

    # Discover every FY present in the data
    fys: set[str] = set()
    for d in disposals:
        try:
            fys.add(_to_fy(d["disposal_date"]))
        except Exception:
            pass
    for d in dividends:
        try:
            fys.add(_to_fy(d["payment_date"]))
        except Exception:
            pass
    if not fys:
        fys = {_current_fy()}

    run_at = datetime.now(timezone.utc).isoformat()

    summary_rows: list[dict] = []
    cgt_event_rows: list[dict] = []
    dividend_event_rows: list[dict] = []
    remaining_parcel_rows: list[dict] | None = None

    base_config = {
        "entity_type":                     entity_type,
        "parcel_matching":                 inputs.get("parcel_matching", "fifo") or "fifo",
        "cgt_method":                      inputs.get("cgt_method", "auto") or "auto",
        "prior_year_carried_forward_loss": inputs.get("prior_year_loss", 0) or 0,
    }

    for fy in sorted(fys):
        engine_input = {
            "config": {**base_config, "financial_year": fy},
            "parcels":   parcels,
            "disposals": disposals,
            "dividends": dividends,
        }

        output = _engine_calculate(engine_input)
        output["status"] = "ok"

        mart = to_mart_tax_rows(user_id, run_id, output)

        summary = mart["mart_tax_summary"]
        summary["run_at"] = run_at
        summary_rows.append(summary)

        for row in mart["mart_tax_cgt_events"]:
            row["run_at"] = run_at
        cgt_event_rows.extend(mart["mart_tax_cgt_events"])

        for row in mart["mart_tax_dividend_events"]:
            row["run_at"] = run_at
        dividend_event_rows.extend(mart["mart_tax_dividend_events"])

        # Remaining parcels are identical each run — keep the first set
        if remaining_parcel_rows is None:
            remaining_parcel_rows = mart["mart_tax_remaining_parcels"]
            for row in remaining_parcel_rows:
                row["run_at"] = run_at
                # remaining parcels are current state, not FY-specific
                row["financial_year"] = _current_fy()

    return {
        "mart_tax_summary":           summary_rows,
        "mart_tax_cgt_events":        cgt_event_rows,
        "mart_tax_dividend_events":   dividend_event_rows,
        "mart_tax_remaining_parcels": remaining_parcel_rows or [],
    }
