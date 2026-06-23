"""
Calculation orchestrator — entry point for calculate_user_data_dag.

Loads all shared inputs once, then calls each feature calculation module and
inserts results into the respective mart tables (append-only, never update).

Tax engine is special: calc_tax() returns a dict of 4 tables rather than a
flat list. main.py detects this and merges all 4 tables into results.
"""
import os
import uuid
from datetime import datetime, timezone

from supabase import create_client

from calculations.performance           import calculate as calc_performance
from calculations.sold_securities       import calculate as calc_sold_securities
from calculations.tax                   import calculate as calc_tax
from calculations.contribution_analysis import calculate as calc_contribution
from calculations.future_income         import calculate as calc_future_income
from calculations.calendar              import calculate as calc_calendar
from calculations.multi_currency        import calculate as calc_multi_currency
from calculations.multi_period          import calculate as calc_multi_period


def run(user_id: str, **kwargs):
    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    inputs = _load_inputs(client, user_id)
    if not inputs["parcels"]:
        print(f"No buy activities for user {user_id} — skipping calculations")
        return

    run_id = str(uuid.uuid4())
    print(f"Starting calculations for user {user_id}, run_id={run_id}")

    mart_rows = run_all_calculations(user_id, run_id, inputs)
    for table, rows in mart_rows.items():
        if rows:
            client.table(table).insert(rows).execute()
            print(f"  {table}: inserted {len(rows)} rows")
        else:
            print(f"  {table}: no rows produced")

    print(f"All calculations complete for user {user_id}, run_id={run_id}")


def run_all_calculations(user_id: str, run_id: str, inputs: dict) -> dict[str, list[dict]]:
    """Call all calculation modules and return {table_name: [rows]}."""
    results: dict[str, list[dict]] = {}

    # Standard modules: calc_fn returns a flat list[dict] for a single table
    _standard_modules = [
        ("mart_performance",           calc_performance),
        ("mart_sold_securities",       calc_sold_securities),
        ("mart_contribution_analysis", calc_contribution),
        ("mart_future_income",         calc_future_income),
        ("mart_calendar_events",       calc_calendar),
        ("mart_multi_currency",        calc_multi_currency),
        ("mart_multi_period",          calc_multi_period),
    ]
    for table, calc_fn in _standard_modules:
        try:
            rows = calc_fn(user_id, run_id, inputs)
            results[table] = rows or []
        except Exception as exc:
            print(f"  {table}: ERROR — {exc}")
            raise

    # Tax engine returns dict[table_name, list[dict]] for 4 tables
    try:
        tax_tables = calc_tax(user_id, run_id, inputs)
        results.update(tax_tables)
    except Exception as exc:
        print(f"  tax engine: ERROR — {exc}")
        raise

    return results


# ── helpers ────────────────────────────────────────────────────────────────────

def _load_inputs(client, user_id: str) -> dict:
    parcels   = client.table("int_parcels").select("*").eq("user_id", user_id).execute().data or []
    disposals = client.table("int_disposals").select("*").eq("user_id", user_id).execute().data or []
    dividends = client.table("int_dividends").select("*").eq("user_id", user_id).execute().data or []

    prices_rows = client.table("int_latest_prices").select("*").execute().data or []
    prices = {r["symbol"]: r for r in prices_rows}

    # FX rates — gracefully skip if table not yet created
    fx_rates: dict[str, float] = {"AUD": 1.0}
    try:
        fx_rows = (
            client.table("int_latest_fx_rates")
            .select("from_currency, to_currency, rate")
            .eq("to_currency", "AUD")
            .execute()
            .data or []
        )
        fx_rates.update({r["from_currency"]: float(r["rate"]) for r in fx_rows})
    except Exception:
        pass

    securities_rows = client.table("int_securities_meta").select("*").execute().data or []
    securities = {r["symbol"]: r for r in securities_rows}

    # Tax preferences — read from user_settings; safe defaults if row absent
    prefs: dict = {}
    try:
        prefs = (
            client.table("user_settings")
            .select("entity_type, parcel_matching, cgt_method, prior_year_loss")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
            .data
        ) or {}
    except Exception:
        pass  # row not yet created; all fields will use defaults below

    entity_type     = prefs.get("entity_type", "individual") or "individual"
    parcel_matching = prefs.get("parcel_matching", "fifo") or "fifo"
    cgt_method      = prefs.get("cgt_method", "auto") or "auto"
    prior_year_loss = float(prefs.get("prior_year_loss") or 0)

    to_date = datetime.now(timezone.utc).date().isoformat()

    raw_from = (
        min(p["acquired_date"] for p in parcels if p.get("acquired_date"))
        if parcels else None
    )
    from_date = str(raw_from)[:10] if raw_from else to_date

    return {
        "parcels":         parcels,
        "disposals":       disposals,
        "dividends":       dividends,
        "prices":          prices,
        "fx_rates":        fx_rates,
        "securities":      securities,
        "entity_type":     entity_type,
        "parcel_matching": parcel_matching,
        "cgt_method":      cgt_method,
        "prior_year_loss": prior_year_loss,
        "from_date":       from_date,
        "to_date":         to_date,
    }
