"""
Scheduled market price ingestion pipeline.

Replaces: fetch_market_data_dag.py (price half only — FX is now a separate DAG)

Schedule:  */15 10-16 * * 1-5  (every 15 min, 10 AM–4 PM Melbourne, Mon–Fri)
           Covers ASX trading hours; automatically adjusts for AEDT daylight saving.

Task graph:
  get_active_symbols
        ↓
  fetch_market_prices  ──(on_failure_callback)──► written to data_freshness as failed
        ↓  (trigger_rule=NONE_FAILED_MIN_ONE_SUCCESS)
  validate_price_data
        ↓
  load_raw_market_data
        ↓
  run_dbt_price_models   (stg_market_data → int_latest_prices)
        ↓
  flag_price_freshness   (upsert data_freshness per symbol)
        ↓
  mark_user_engines_stale  (engine_run_state for Group A+B+C per affected user)

Failure policy:
  - fetch_market_prices retries 2× before invoking on_failure_callback.
  - on_failure_callback writes data_freshness.fetch_status='failed' but does NOT
    raise — downstream tasks skip gracefully via trigger_rule, so the DAG finishes
    with status 'success' (no data) rather than 'failed'. This prevents alert fatigue
    from temporary Yahoo Finance outages.

Symbol list:
  - Primary source: Airflow Variable ACTIVE_SYMBOLS (JSON array of {"symbol","exchange"} dicts)
  - Fallback: queries the Supabase `securities` table directly.
  - To update without restarting Airflow: Airflow UI → Admin → Variables → ACTIVE_SYMBOLS
"""

import json
import os
import sys
import time
import hashlib
from datetime import datetime, timezone

from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.trigger_rule import TriggerRule

sys.path.insert(0, "/opt/airflow")

from supabase import create_client

_DBT_DIR = "/opt/airflow/dbt"
_DBT_TARGET_DIR = "/tmp/dbt_target"

# Engines that depend on market prices (Group A + B + C)
_PRICE_DEPENDENT_ENGINES = [
    "performance",           # Group A
    "contribution_analysis", # Group A
    "multi_period",          # Group A
    "multi_currency",        # Group B
    "future_income",         # Group C
]


def _supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


# ── failure callback ───────────────────────────────────────────────────────────

def _on_price_fetch_failure(context):
    """
    Called when fetch_market_prices exhausts its retries.
    Marks data_freshness as failed so engines know prices may be stale.
    Does NOT re-raise — lets the DAG complete with a warning rather than failing.
    """
    try:
        client = _supabase()
        client.table("data_freshness").upsert(
            [{
                "data_type": "market_price",
                "symbol": None,
                "currency_pair": None,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "is_stale": True,
                "fetch_status": "failed",
                "error_detail": str(context.get("exception", "unknown error"))[:500],
            }],
            on_conflict="data_type,symbol,currency_pair",
        ).execute()
        print(f"[on_failure] Marked market_price as failed in data_freshness")
    except Exception as exc:
        print(f"[on_failure] Could not write to data_freshness: {exc}")


# ── task 1: get_active_symbols ─────────────────────────────────────────────────

def get_active_symbols(**kwargs):
    """
    Load the symbol list from Airflow Variable ACTIVE_SYMBOLS (preferred) or
    fall back to the Supabase securities table.

    Pushing to XCom: key='securities' → list[{symbol, exchange}]
    """
    ti = kwargs["ti"]

    symbols_json = Variable.get("ACTIVE_SYMBOLS", default_var=None)
    if symbols_json:
        securities = json.loads(symbols_json)
        print(f"Loaded {len(securities)} symbols from Airflow Variable ACTIVE_SYMBOLS")
    else:
        client = _supabase()
        res = client.table("securities").select("symbol, exchange, currency").execute()
        securities = [
            {"symbol": r["symbol"], "exchange": r.get("exchange")}
            for r in (res.data or [])
            if r.get("symbol")
        ]
        print(f"Loaded {len(securities)} symbols from Supabase securities table (Variable not set)")

    ti.xcom_push(key="securities", value=securities)


# ── task 2: fetch_market_prices ────────────────────────────────────────────────

def fetch_market_prices(**kwargs):
    """
    Fetch prices for all active symbols via the configured MarketDataProvider.
    on_failure_callback fires if this task fails after retries.
    """
    ti = kwargs["ti"]
    securities = ti.xcom_pull(task_ids="get_active_symbols", key="securities") or []

    if not securities:
        print("No symbols found — skipping price fetch")
        ti.xcom_push(key="price_rows", value=[])
        return

    from fetch.provider_factory import get_price_provider
    provider = get_price_provider()
    rows = provider.fetch(securities)

    ti.xcom_push(key="price_rows", value=rows)
    print(f"Fetched {len(rows)} price rows")


# ── task 3: validate_price_data ────────────────────────────────────────────────

def validate_price_data(**kwargs):
    """
    Drop rows with missing or zero price.
    Fail if >20% of symbols returned bad data (likely a provider issue).
    Pushes only valid rows to XCom.
    """
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="fetch_market_prices", key="price_rows") or []

    valid = [r for r in rows if r.get("regular_market_price") and float(r["regular_market_price"]) > 0]
    invalid_count = len(rows) - len(valid)

    if invalid_count:
        print(f"Validation: dropped {invalid_count} rows with missing/zero price")

    if rows and len(valid) < len(rows) * 0.8:
        raise ValueError(
            f"Too many invalid prices: {invalid_count}/{len(rows)} failed "
            f"(threshold 20%). Aborting load."
        )

    ti.xcom_push(key="valid_price_rows", value=valid)
    print(f"Validation passed: {len(valid)} valid rows")


# ── task 4: load_raw_market_data ───────────────────────────────────────────────

def load_raw_market_data(**kwargs):
    """
    Insert valid price rows into raw_market_data (append-only).
    Pushes the list of updated symbols for downstream freshness flagging.
    """
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="validate_price_data", key="valid_price_rows") or []

    if not rows:
        print("No valid price rows to save")
        ti.xcom_push(key="updated_symbols", value=[])
        return

    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        row.setdefault("fetched_at", now)

    client = _supabase()
    client.table("raw_market_data").insert(rows).execute()

    updated_symbols = [r["symbol"] for r in rows if r.get("symbol")]
    ti.xcom_push(key="updated_symbols", value=updated_symbols)
    print(f"Inserted {len(rows)} rows into raw_market_data")


# ── task 5: flag_price_freshness ───────────────────────────────────────────────

def flag_price_freshness(**kwargs):
    """
    Upsert one row per symbol into data_freshness:
      data_type='market_price', is_stale=False, fetch_status='ok'
    This is the signal that downstream engines use to know prices are current.
    """
    ti = kwargs["ti"]
    updated_symbols = ti.xcom_pull(task_ids="load_raw_market_data", key="updated_symbols") or []

    if not updated_symbols:
        print("No symbols to flag — skipping freshness update")
        return

    client = _supabase()
    now = datetime.now(timezone.utc).isoformat()
    freshness_rows = [
        {
            "data_type": "market_price",
            "symbol": sym,
            "currency_pair": None,
            "last_updated": now,
            "is_stale": False,
            "fetch_status": "ok",
            "error_detail": None,
        }
        for sym in updated_symbols
    ]
    client.table("data_freshness").upsert(
        freshness_rows,
        on_conflict="data_type,symbol,currency_pair",
    ).execute()
    print(f"Flagged freshness for {len(updated_symbols)} symbols")


# ── task 6: mark_user_engines_stale ───────────────────────────────────────────

def mark_user_engines_stale(**kwargs):
    """
    For each updated symbol, find users who currently hold it (have active BUY parcels).
    Mark engine_run_state.is_stale=TRUE for Group A + B + C engines for those users.

    This does NOT trigger a recalculation — engines run lazily when the user next
    hits the API. Only THAT user's engines are marked stale; other users are untouched.
    """
    ti = kwargs["ti"]
    updated_symbols = ti.xcom_pull(task_ids="load_raw_market_data", key="updated_symbols") or []

    if not updated_symbols:
        print("No updated symbols — skipping engine staleness marking")
        return

    client = _supabase()

    # Use the Supabase RPC to find users holding any of the updated symbols.
    # The function is defined in database/get_users_holding_symbols.sql
    try:
        result = client.rpc(
            "get_users_holding_symbols",
            {"p_symbols": updated_symbols},
        ).execute()
        affected_users = [r["user_id"] for r in (result.data or [])]
    except Exception as exc:
        # Graceful fallback: query activities table directly
        print(f"RPC failed ({exc}), falling back to direct activities query")
        res = (
            client.table("activities")
            .select("user_id, securities!inner(symbol)")
            .eq("type", "BUY")
            .in_("securities.symbol", updated_symbols)
            .execute()
        )
        affected_users = list({r["user_id"] for r in (res.data or []) if r.get("user_id")})

    if not affected_users:
        print("No users hold these symbols — nothing to mark stale")
        return

    now = datetime.now(timezone.utc).isoformat()
    upsert_rows = [
        {
            "user_id": uid,
            "engine_name": eng,
            "is_stale": True,
            "stale_reason": "price_update",
        }
        for uid in affected_users
        for eng in _PRICE_DEPENDENT_ENGINES
    ]

    # Batch upsert in chunks of 500 to stay within Supabase row limits
    chunk_size = 500
    for i in range(0, len(upsert_rows), chunk_size):
        client.table("engine_run_state").upsert(
            upsert_rows[i:i + chunk_size],
            on_conflict="user_id,engine_name",
        ).execute()

    print(
        f"Marked {len(_PRICE_DEPENDENT_ENGINES)} engines stale "
        f"for {len(affected_users)} users "
        f"(symbols: {updated_symbols[:5]}{'...' if len(updated_symbols) > 5 else ''})"
    )


# ── DAG definition ─────────────────────────────────────────────────────────────

default_args = {
    "owner": "nexgen",
    "retries": 2,
    "retry_delay": 60,  # seconds
    "on_failure_callback": _on_price_fetch_failure,
}

with DAG(
    dag_id="scheduled_market_price_dag",
    default_args=default_args,
    description="Fetch ASX market prices every 15 min during trading hours; mark affected user engines stale",
    schedule_interval="*/15 10-16 * * 1-5",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,          # prevent overlapping runs during slow fetches
    tags=["market-data", "scheduled", "prices"],
    params={"timezone": "Australia/Melbourne"},
) as dag:

    t1_symbols = PythonOperator(
        task_id="get_active_symbols",
        python_callable=get_active_symbols,
    )

    t2_fetch = PythonOperator(
        task_id="fetch_market_prices",
        python_callable=fetch_market_prices,
        on_failure_callback=_on_price_fetch_failure,
    )

    t3_validate = PythonOperator(
        task_id="validate_price_data",
        python_callable=validate_price_data,
        trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
    )

    t4_load = PythonOperator(
        task_id="load_raw_market_data",
        python_callable=load_raw_market_data,
    )

    # int_securities_meta is intentionally excluded — it is a VIEW over the
    # securities table and is always current without rebuilding. Running dbt on
    # a VIEW triggers Supabase's RLS hook which cannot enable RLS on views.
    t5_dbt = BashOperator(
        task_id="run_dbt_price_models",
        bash_command=(
            f"cd {_DBT_DIR} && "
            f"dbt run --select stg_market_data int_latest_prices "
            f"--target-path {_DBT_TARGET_DIR} --threads 4"
        ),
    )

    t6_freshness = PythonOperator(
        task_id="flag_price_freshness",
        python_callable=flag_price_freshness,
    )

    t7_stale = PythonOperator(
        task_id="mark_user_engines_stale",
        python_callable=mark_user_engines_stale,
    )

    t1_symbols >> t2_fetch >> t3_validate >> t4_load >> t5_dbt >> t6_freshness >> t7_stale
