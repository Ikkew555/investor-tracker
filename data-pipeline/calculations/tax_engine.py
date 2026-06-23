"""
Nexgen Portfolio — Australian Tax Engine (canonical copy for the pipeline container).
Source of truth: project_app/tax_calculate_engine.py  (kept in sync manually).
"""

from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from math import floor
from typing import Any, Dict, List, Union

CPI_TABLE = {
    "1985-Q3": 71.3, "1985-Q4": 72.7,
    "1986-Q1": 74.4, "1986-Q2": 75.6, "1986-Q3": 77.0, "1986-Q4": 78.4,
    "1987-Q1": 79.8, "1987-Q2": 80.9, "1987-Q3": 81.8, "1987-Q4": 83.0,
    "1988-Q1": 84.0, "1988-Q2": 85.5, "1988-Q3": 87.1, "1988-Q4": 88.5,
    "1989-Q1": 90.2, "1989-Q2": 92.0, "1989-Q3": 93.6, "1989-Q4": 95.2,
    "1990-Q1": 97.2, "1990-Q2": 98.8, "1990-Q3": 99.7, "1990-Q4": 100.9,
    "1991-Q1": 102.0, "1991-Q2": 102.2, "1991-Q3": 102.7, "1991-Q4": 103.4,
    "1992-Q1": 103.5, "1992-Q2": 103.5, "1992-Q3": 103.6, "1992-Q4": 103.8,
    "1993-Q1": 104.3, "1993-Q2": 104.5, "1993-Q3": 105.2, "1993-Q4": 105.5,
    "1994-Q1": 105.7, "1994-Q2": 106.2, "1994-Q3": 106.9, "1994-Q4": 107.5,
    "1995-Q1": 108.9, "1995-Q2": 110.0, "1995-Q3": 110.5, "1995-Q4": 111.3,
    "1996-Q1": 111.9, "1996-Q2": 112.1, "1996-Q3": 112.0, "1996-Q4": 112.4,
    "1997-Q1": 112.4, "1997-Q2": 112.1, "1997-Q3": 111.9, "1997-Q4": 111.7,
    "1998-Q1": 111.8, "1998-Q2": 112.0, "1998-Q3": 112.3, "1998-Q4": 112.7,
    "1999-Q1": 113.2, "1999-Q2": 113.7, "1999-Q3": 114.7,
}

CPI_CAP_QUARTER = "1999-Q3"
INDEXATION_CUTOFF = datetime(1999, 9, 21, tzinfo=timezone.utc)
CGT_DISCOUNT_MIN_DAYS = 365
COMPANY_TAX_RATE = 0.30
FY_START_MONTH = 7
ENGINE_VERSION = "1.0.0"

DISCOUNT_RATES = {
    "individual": 0.50,
    "trust": 0.50,
    "super": 0.3333,
    "company": 0.00,
}


def r2(value: float) -> float:
    return round(float(value) + 1e-12, 2)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def to_date(value: Union[str, datetime]) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(f"Invalid date: {value}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def days_between(a: Union[str, datetime], b: Union[str, datetime]) -> int:
    return floor((to_date(b) - to_date(a)).total_seconds() / 86400)


def to_cpi_quarter(value: Union[str, datetime]) -> str:
    dt = to_date(value)
    month = dt.month
    quarter = "Q1" if month <= 3 else "Q2" if month <= 6 else "Q3" if month <= 9 else "Q4"
    return f"{dt.year}-{quarter}"


def get_cpi(quarter: str) -> float:
    q = CPI_CAP_QUARTER if quarter > CPI_CAP_QUARTER else quarter
    if q not in CPI_TABLE:
        raise ValueError(f"CPI data unavailable for {quarter}. Indexation requires acquisition after Sep 1985.")
    return CPI_TABLE[q]


def to_fy(value: Union[str, datetime]) -> str:
    dt = to_date(value)
    return f"FY{dt.year + 1}" if dt.month >= FY_START_MONTH else f"FY{dt.year}"


def match_parcels(available_parcels: List[dict], quantity_needed: float, strategy: str, disposal_date: str) -> List[dict]:
    if strategy == "lifo":
        sorted_parcels = sorted(available_parcels, key=lambda p: to_date(p["acquired_date"]), reverse=True)
    elif strategy == "minimise_tax":
        def sort_key(p: dict):
            unit_cost = p["cost_base"] / p["quantity"]
            discount_eligible = days_between(p["acquired_date"], disposal_date) >= CGT_DISCOUNT_MIN_DAYS
            return (-unit_cost, not discount_eligible, to_date(p["acquired_date"]))
        sorted_parcels = sorted(available_parcels, key=sort_key)
    else:
        sorted_parcels = sorted(available_parcels, key=lambda p: to_date(p["acquired_date"]))

    matches = []
    remaining = quantity_needed
    for parcel in sorted_parcels:
        if remaining <= 0:
            break
        units_used = min(parcel["_remaining"], remaining)
        proportion = units_used / parcel["quantity"]
        cost_base_used = r2(parcel["cost_base"] * proportion)
        matches.append({"parcel": parcel, "units_used": units_used, "cost_base_used": cost_base_used})
        remaining -= units_used

    if remaining > 0.0001:
        symbol = available_parcels[0].get("symbol") if available_parcels else "UNKNOWN"
        raise ValueError(f"Insufficient parcel balance for {symbol}: needed {quantity_needed}, available {quantity_needed - remaining}.")

    return matches


def indexed_cost(parcel: dict, cost_base_used: float, disposal_date: str) -> float:
    try:
        cpi_acq = get_cpi(to_cpi_quarter(parcel["acquired_date"]))
        cpi_dis = get_cpi(to_cpi_quarter(disposal_date))
        return r2(cost_base_used * (cpi_dis / cpi_acq))
    except Exception:
        return cost_base_used


def compute_cgt_event(match: dict, disposal_date: str, net_proceeds: float, total_qty: float, entity_type: str, cgt_method: str) -> dict:
    parcel = match["parcel"]
    units_used = match["units_used"]
    cost_base_used = match["cost_base_used"]
    discount_rate = DISCOUNT_RATES.get(entity_type, 0)
    holding_days = days_between(parcel["acquired_date"], disposal_date)

    proceeds = r2(net_proceeds * (units_used / total_qty))
    raw_gain = r2(proceeds - cost_base_used)
    is_loss = raw_gain < 0

    method = "other"
    discount_applied = 0.0
    indexed_cost_base = cost_base_used
    net_gain = 0.0
    capital_loss = 0.0

    if is_loss:
        rcb_proportion = units_used / parcel["quantity"]
        rcb_used = r2(parcel.get("reduced_cost_base", parcel["cost_base"]) * rcb_proportion)
        capital_loss = r2(max(0, rcb_used - proceeds))
        method = "loss"
    else:
        discount_eligible = holding_days >= CGT_DISCOUNT_MIN_DAYS and discount_rate > 0
        indexation_eligible = to_date(parcel["acquired_date"]) < INDEXATION_CUTOFF and entity_type != "super"

        resolved = cgt_method
        if cgt_method == "auto":
            if indexation_eligible and discount_eligible:
                idx_cost = indexed_cost(parcel, cost_base_used, disposal_date)
                idx_gain = r2(max(0, proceeds - idx_cost))
                disc_gain = r2(raw_gain * (1 - discount_rate))
                resolved = "indexation" if idx_gain <= disc_gain else "discount"
            elif indexation_eligible:
                resolved = "indexation"
            elif discount_eligible:
                resolved = "discount"
            else:
                resolved = "other"

        if resolved == "indexation" and indexation_eligible:
            indexed_cost_base = indexed_cost(parcel, cost_base_used, disposal_date)
            net_gain = r2(max(0, proceeds - indexed_cost_base))
            method = "indexation"
        elif resolved == "discount" and discount_eligible:
            discount_applied = r2(raw_gain * discount_rate)
            net_gain = r2(raw_gain - discount_applied)
            method = "discount"
        else:
            net_gain = raw_gain
            method = "other"

    return {
        "parcel_id": parcel["parcel_id"],
        "disposal_id": None,
        "symbol": parcel["symbol"].upper(),
        "acquired_date": parcel["acquired_date"],
        "disposal_date": disposal_date,
        "holding_days": holding_days,
        "units_disposed": r2(units_used),
        "cost_base": r2(cost_base_used),
        "indexed_cost_base": r2(indexed_cost_base),
        "proceeds": proceeds,
        "raw_gain": raw_gain,
        "cgt_method": method,
        "discount_rate": 0 if is_loss else discount_rate,
        "discount_applied": r2(discount_applied),
        "net_gain": r2(net_gain),
        "capital_loss": r2(capital_loss),
        "is_loss": is_loss,
    }


def resolve_franking_credits(dividend: dict) -> float:
    if isinstance(dividend.get("franking_credits"), (int, float)):
        return r2(dividend["franking_credits"])
    pct = dividend.get("franking_percent", 0) or 0
    return r2(dividend["cash_amount"] * (pct / 100) * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE)))


def calculate(input_data: dict) -> dict:
    config = input_data["config"]
    entity_type = config["entity_type"]
    parcel_matching = config["parcel_matching"]
    cgt_method = config["cgt_method"]
    financial_year = config["financial_year"]
    prior_year_loss = config["prior_year_carried_forward_loss"]

    parcel_pool = []
    for p in input_data["parcels"]:
        item = copy.deepcopy(p)
        item["symbol"] = item["symbol"].upper()
        item["reduced_cost_base"] = item.get("reduced_cost_base", item["cost_base"])
        item["_remaining"] = item["quantity"]
        parcel_pool.append(item)

    parcel_index: Dict[str, List[dict]] = {}
    for p in parcel_pool:
        parcel_index.setdefault(p["symbol"], []).append(p)

    cgt_events: List[dict] = []
    disposal_errors: List[dict] = []
    sorted_disposals = sorted(input_data["disposals"], key=lambda d: to_date(d["disposal_date"]))

    for disposal in sorted_disposals:
        symbol = disposal["symbol"].upper()
        net_proceeds = r2((disposal.get("gross_proceeds") or 0) - (disposal.get("brokerage") or 0))
        available = [p for p in parcel_index.get(symbol, []) if p["_remaining"] > 0.0001]

        if not available:
            disposal_errors.append({"disposal_id": disposal["disposal_id"], "error": f"No parcels with remaining balance found for symbol {symbol}."})
            continue

        try:
            matches = match_parcels(available, disposal["quantity"], parcel_matching, disposal["disposal_date"])
        except Exception as exc:
            disposal_errors.append({"disposal_id": disposal["disposal_id"], "error": str(exc)})
            continue

        for match in matches:
            match["parcel"]["_remaining"] = r2(match["parcel"]["_remaining"] - match["units_used"])
            event = compute_cgt_event(match, disposal["disposal_date"], net_proceeds, disposal["quantity"], entity_type, cgt_method)
            event["disposal_id"] = disposal["disposal_id"]
            cgt_events.append(event)

    fy_cgt_events = [e for e in cgt_events if to_fy(e["disposal_date"]) == financial_year]

    total_gross_gains = 0.0
    total_discounts = 0.0
    total_net_gains = 0.0
    total_capital_losses = 0.0

    for e in fy_cgt_events:
        if e["is_loss"]:
            total_capital_losses += e["capital_loss"]
        else:
            total_gross_gains += r2(e["net_gain"] + e["discount_applied"])
            total_discounts += e["discount_applied"]
            total_net_gains += e["net_gain"]

    total_gross_gains = r2(total_gross_gains)
    total_discounts = r2(total_discounts)
    total_net_gains = r2(total_net_gains)
    total_capital_losses = r2(total_capital_losses)

    net_after_current_losses = r2(total_net_gains - total_capital_losses)
    carried_forward_applied = 0.0
    remaining_prior_loss = prior_year_loss

    if net_after_current_losses > 0 and remaining_prior_loss > 0:
        carried_forward_applied = r2(min(net_after_current_losses, remaining_prior_loss))
        remaining_prior_loss = r2(remaining_prior_loss - carried_forward_applied)
        net_after_current_losses = r2(net_after_current_losses - carried_forward_applied)

    net_capital_gain = r2(max(0, net_after_current_losses))
    new_carried_forward_loss = r2(abs(net_after_current_losses) + remaining_prior_loss) if net_after_current_losses < 0 else r2(remaining_prior_loss)

    fy_dividends = [d for d in input_data["dividends"] if to_fy(d["payment_date"]) == financial_year]
    dividend_events = []
    for d in fy_dividends:
        franking_credits = resolve_franking_credits(d)
        grossed_up = r2(d["cash_amount"] + franking_credits)
        if isinstance(d.get("franking_percent"), (int, float)):
            franking_percent = d["franking_percent"]
        else:
            denom = d["cash_amount"] * (COMPANY_TAX_RATE / (1 - COMPANY_TAX_RATE))
            franking_percent = r2((franking_credits / denom) * 100) if denom else 0
        dividend_events.append({
            "dividend_id": d["dividend_id"],
            "symbol": d["symbol"].upper(),
            "payment_date": d["payment_date"],
            "cash_amount": r2(d["cash_amount"]),
            "franking_percent": r2(franking_percent),
            "franking_credits": franking_credits,
            "grossed_up_dividend": grossed_up,
        })

    total_cash_dividends = r2(sum(d["cash_amount"] for d in dividend_events))
    total_franking_credits = r2(sum(d["franking_credits"] for d in dividend_events))
    total_grossed_up_income = r2(sum(d["grossed_up_dividend"] for d in dividend_events))

    remaining_parcels = []
    for p in parcel_pool:
        if p["_remaining"] > 0.0001:
            remaining_parcels.append({
                "parcel_id": p["parcel_id"],
                "symbol": p["symbol"].upper(),
                "acquired_date": p["acquired_date"],
                "original_quantity": p["quantity"],
                "remaining_quantity": r2(p["_remaining"]),
                "remaining_cost_base": r2(p["cost_base"] * (p["_remaining"] / p["quantity"])),
                "unit_cost_base": r2(p["cost_base"] / p["quantity"]),
            })

    method_breakdown: Dict[str, dict] = {}
    for e in fy_cgt_events:
        method = e["cgt_method"]
        method_breakdown.setdefault(method, {
            "event_count": 0,
            "total_net_gain": 0.0,
            "total_capital_loss": 0.0,
            "total_discount_applied": 0.0,
        })
        method_breakdown[method]["event_count"] += 1
        method_breakdown[method]["total_net_gain"] = r2(method_breakdown[method]["total_net_gain"] + e["net_gain"])
        method_breakdown[method]["total_capital_loss"] = r2(method_breakdown[method]["total_capital_loss"] + e["capital_loss"])
        method_breakdown[method]["total_discount_applied"] = r2(method_breakdown[method]["total_discount_applied"] + e["discount_applied"])

    return {
        "meta": {
            "engine_version": ENGINE_VERSION,
            "calculated_at": now_iso(),
            "financial_year": financial_year,
            "entity_type": entity_type,
            "parcel_matching": parcel_matching,
            "cgt_method_config": cgt_method,
        },
        "cgt_summary": {
            "total_gross_gains": total_gross_gains,
            "total_cgt_discount_applied": total_discounts,
            "total_net_gains_after_discount": total_net_gains,
            "total_capital_losses": total_capital_losses,
            "prior_year_carried_forward_loss_applied": carried_forward_applied,
            "net_capital_gain": net_capital_gain,
            "new_carried_forward_loss": new_carried_forward_loss,
        },
        "dividend_summary": {
            "total_cash_dividends": total_cash_dividends,
            "total_franking_credits": total_franking_credits,
            "total_grossed_up_income": total_grossed_up_income,
        },
        "cgt_events": fy_cgt_events,
        "dividend_events": dividend_events,
        "remaining_parcels": remaining_parcels,
        "method_breakdown": method_breakdown,
        "disposal_errors": disposal_errors,
    }


# ── mart row converters ────────────────────────────────────────────────────────

def _date_only(value: Any) -> Any:
    if value is None:
        return None
    try:
        return to_date(value).date().isoformat()
    except Exception:
        return value


def to_mart_tax_summary_row(user_id: str, run_id: str, output: dict) -> dict:
    meta = output.get("meta", {}) or {}
    cgt = output.get("cgt_summary", {}) or {}
    div = output.get("dividend_summary", {}) or {}
    return {
        "user_id": user_id,
        "run_id": run_id,
        "status": output.get("status", "ok"),
        "engine_version": meta.get("engine_version"),
        "calculated_at": meta.get("calculated_at"),
        "financial_year": meta.get("financial_year"),
        "entity_type": meta.get("entity_type"),
        "parcel_matching": meta.get("parcel_matching"),
        "cgt_method_config": meta.get("cgt_method_config"),
        "total_gross_gains": cgt.get("total_gross_gains", 0),
        "total_cgt_discount_applied": cgt.get("total_cgt_discount_applied", 0),
        "total_net_gains_after_discount": cgt.get("total_net_gains_after_discount", 0),
        "total_capital_losses": cgt.get("total_capital_losses", 0),
        "prior_year_carried_forward_loss_applied": cgt.get("prior_year_carried_forward_loss_applied", 0),
        "net_capital_gain": cgt.get("net_capital_gain", 0),
        "new_carried_forward_loss": cgt.get("new_carried_forward_loss", 0),
        "total_cash_dividends": div.get("total_cash_dividends", 0),
        "total_franking_credits": div.get("total_franking_credits", 0),
        "total_grossed_up_income": div.get("total_grossed_up_income", 0),
        "cgt_event_count": len(output.get("cgt_events", []) or []),
        "dividend_event_count": len(output.get("dividend_events", []) or []),
        "remaining_parcel_count": len(output.get("remaining_parcels", []) or []),
        "disposal_error_count": len(output.get("disposal_errors", []) or []),
    }


def to_mart_tax_cgt_event_rows(user_id: str, run_id: str, output: dict) -> List[dict]:
    financial_year = (output.get("meta", {}) or {}).get("financial_year")
    rows: List[dict] = []
    for event in output.get("cgt_events", []) or []:
        rows.append({
            "user_id": user_id,
            "run_id": run_id,
            "financial_year": financial_year,
            "parcel_id": event.get("parcel_id"),
            "disposal_id": event.get("disposal_id"),
            "symbol": event.get("symbol"),
            "acquired_date": _date_only(event.get("acquired_date")),
            "disposal_date": _date_only(event.get("disposal_date")),
            "holding_days": event.get("holding_days"),
            "units_disposed": event.get("units_disposed"),
            "cost_base": event.get("cost_base"),
            "indexed_cost_base": event.get("indexed_cost_base"),
            "proceeds": event.get("proceeds"),
            "raw_gain": event.get("raw_gain"),
            "cgt_method": event.get("cgt_method"),
            "discount_rate": event.get("discount_rate"),
            "discount_applied": event.get("discount_applied"),
            "net_gain": event.get("net_gain"),
            "capital_loss": event.get("capital_loss"),
            "is_loss": event.get("is_loss"),
        })
    return rows


def to_mart_tax_dividend_event_rows(user_id: str, run_id: str, output: dict) -> List[dict]:
    financial_year = (output.get("meta", {}) or {}).get("financial_year")
    rows: List[dict] = []
    for event in output.get("dividend_events", []) or []:
        rows.append({
            "user_id": user_id,
            "run_id": run_id,
            "financial_year": financial_year,
            "dividend_id": event.get("dividend_id"),
            "symbol": event.get("symbol"),
            "payment_date": _date_only(event.get("payment_date")),
            "cash_amount": event.get("cash_amount"),
            "franking_percent": event.get("franking_percent"),
            "franking_credits": event.get("franking_credits"),
            "grossed_up_dividend": event.get("grossed_up_dividend"),
        })
    return rows


def to_mart_tax_remaining_parcel_rows(user_id: str, run_id: str, output: dict) -> List[dict]:
    financial_year = (output.get("meta", {}) or {}).get("financial_year")
    rows: List[dict] = []
    for parcel in output.get("remaining_parcels", []) or []:
        rows.append({
            "user_id": user_id,
            "run_id": run_id,
            "financial_year": financial_year,
            "parcel_id": parcel.get("parcel_id"),
            "symbol": parcel.get("symbol"),
            "acquired_date": _date_only(parcel.get("acquired_date")),
            "original_quantity": parcel.get("original_quantity"),
            "remaining_quantity": parcel.get("remaining_quantity"),
            "remaining_cost_base": parcel.get("remaining_cost_base"),
            "unit_cost_base": parcel.get("unit_cost_base"),
        })
    return rows


def to_mart_tax_rows(user_id: str, run_id: str, output: dict) -> dict:
    return {
        "mart_tax_summary": to_mart_tax_summary_row(user_id, run_id, output),
        "mart_tax_cgt_events": to_mart_tax_cgt_event_rows(user_id, run_id, output),
        "mart_tax_dividend_events": to_mart_tax_dividend_event_rows(user_id, run_id, output),
        "mart_tax_remaining_parcels": to_mart_tax_remaining_parcel_rows(user_id, run_id, output),
    }
