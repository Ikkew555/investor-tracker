"""
Scheduled FX rate ingestion pipeline.

Extracted from: fetch_market_data_dag.py (FX half)

Schedule:  0 */1 * * *  (every hour, 24/7 — currency markets never close)
Timezone:  UTC

Task graph:
  get_active_currencies
        ↓
  fetch_fx_rates  ──(on_failure_callback)──► data_freshness marked failed
        ↓  (trigger_rule=NONE_FAILED_MIN_ONE_SUCCESS)
  validate_fx_data
        ↓
  load_raw_fx_rates
        ↓
  run_dbt_fx_models   (stg_fx_rates → int_latest_fx_rates)
        ↓
  flag_fx_freshness
        ↓
  mark_user_engines_stale  (engine_run_state for multi_currency / Group B only)

Currency list:
  - Primary: Airflow Variable ACTIVE_CURRENCIES (JSON array of currency codes, e.g. ["USD","GBP"])
  - Fallback: derived from the `currency` column of the Supabase `securities` table.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import requests
from airflow import DAG
from airflow.models import Variable
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.trigger_rule import TriggerRule

sys.path.insert(0, "/opt/airflow")

from supabase import create_client

_DBT_DIR = "/opt/airflow/dbt"
_DBT_TARGET_DIR = "/tmp/dbt_target"

# Only multi_currency (Group B) depends on FX rates
_FX_DEPENDENT_ENGINES = ["multi_currency"]

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com",
}


def _supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


# ── failure callback ───────────────────────────────────────────────────────────

def _on_fx_fetch_failure(context):
    try:
        client = _supabase()
        client.table("data_freshness").upsert(
            [{
                "data_type": "fx_rate",
                "symbol": None,
                "currency_pair": None,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "is_stale": True,
                "fetch_status": "failed",
                "error_detail": str(context.get("exception", "unknown error"))[:500],
            }],
            on_conflict="data_type,symbol,currency_pair",
        ).execute()
        print("[on_failure] Marked fx_rate as failed in data_freshness")
    except Exception as exc:
        print(f"[on_failure] Could not write to data_freshness: {exc}")


# ── task 1: get_active_currencies ─────────────────────────────────────────────

def get_active_currencies(**kwargs):
    """
    Load the currency list from Airflow Variable ACTIVE_CURRENCIES or
    fall back to deriving non-AUD currencies from the securities table.
    """
    ti = kwargs["ti"]

    currencies_json = Variable.get("ACTIVE_CURRENCIES", default_var=None)
    if currencies_json:
        currencies = json.loads(currencies_json)
        print(f"Loaded {len(currencies)} currencies from Airflow Variable ACTIVE_CURRENCIES")
    else:
        client = _supabase()
        res = client.table("securities").select("currency").execute()
        currencies = list({
            r["currency"].upper()
            for r in (res.data or [])
            if r.get("currency") and r["currency"].upper() != "AUD"
        })
        print(f"Derived {len(currencies)} non-AUD currencies from securities table: {currencies}")

    ti.xcom_push(key="currencies", value=currencies)


# ── task 2: fetch_fx_rates ─────────────────────────────────────────────────────

def fetch_fx_rates(**kwargs):
    """
    Fetch {currency}AUD=X rate from Yahoo Finance for each non-AUD currency.
    Retries at the DAG level (retries=2 in default_args).
    """
    ti = kwargs["ti"]
    currencies = ti.xcom_pull(task_ids="get_active_currencies", key="currencies") or []

    if not currencies:
        print("No non-AUD currencies — skipping FX fetch")
        ti.xcom_push(key="fx_rows", value=[])
        return

    rows = []
    failed = []
    for currency in currencies:
        yahoo_sym = f"{currency}AUD=X"
        url = (
            f"https://query2.finance.yahoo.com/v8/finance/chart/{yahoo_sym}"
            "?interval=1d&range=1d"
        )
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=15)
            if resp.status_code == 200:
                result = (resp.json().get("chart", {}).get("result") or [None])[0]
                if result:
                    rate = result.get("meta", {}).get("regularMarketPrice")
                    if rate and float(rate) > 0:
                        rows.append({
                            "from_currency": currency,
                            "to_currency": "AUD",
                            "rate": float(rate),
                            "fetched_at": datetime.now(timezone.utc).isoformat(),
                        })
                        print(f"FX {yahoo_sym}: {rate}")
                    else:
                        failed.append(currency)
                        print(f"FX {yahoo_sym}: no valid rate in response")
            else:
                failed.append(currency)
                print(f"FX {yahoo_sym}: HTTP {resp.status_code}")
            time.sleep(0.1)
        except Exception as exc:
            failed.append(currency)
            print(f"FX {yahoo_sym}: fetch error — {exc}")

    if failed:
        print(f"Warning: failed to fetch rates for {failed}")

    ti.xcom_push(key="fx_rows", value=rows)
    ti.xcom_push(key="failed_currencies", value=failed)
    print(f"Fetched {len(rows)}/{len(currencies)} FX rates")


# ── task 3: validate_fx_data ───────────────────────────────────────────────────

def validate_fx_data(**kwargs):
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="fetch_fx_rates", key="fx_rows") or []

    valid = [r for r in rows if r.get("rate") and float(r["rate"]) > 0]
    print(f"FX validation: {len(valid)} valid rows")
    ti.xcom_push(key="valid_fx_rows", value=valid)


# ── task 4: load_raw_fx_rates ─────────────────────────────────────────────────

def load_raw_fx_rates(**kwargs):
    """Insert validated FX rows into raw_fx_rates (append-only)."""
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="validate_fx_data", key="valid_fx_rows") or []

    if not rows:
        print("No valid FX rows to save")
        ti.xcom_push(key="updated_pairs", value=[])
        return

    client = _supabase()
    client.table("raw_fx_rates").insert(rows).execute()

    updated_pairs = [f"{r['from_currency']}_AUD" for r in rows]
    ti.xcom_push(key="updated_pairs", value=updated_pairs)
    print(f"Inserted {len(rows)} FX rows into raw_fx_rates")


# ── task 5: flag_fx_freshness ─────────────────────────────────────────────────

def flag_fx_freshness(**kwargs):
    """Upsert data_freshness for each currency pair."""
    ti = kwargs["ti"]
    updated_pairs = ti.xcom_pull(task_ids="load_raw_fx_rates", key="updated_pairs") or []

    if not updated_pairs:
        return

    client = _supabase()
    now = datetime.now(timezone.utc).isoformat()
    rows = [
        {
            "data_type": "fx_rate",
            "symbol": None,
            "currency_pair": pair,
            "last_updated": now,
            "is_stale": False,
            "fetch_status": "ok",
            "error_detail": None,
        }
        for pair in updated_pairs
    ]
    client.table("data_freshness").upsert(
        rows,
        on_conflict="data_type,symbol,currency_pair",
    ).execute()
    print(f"Flagged freshness for {len(updated_pairs)} FX pairs")


# ── task 6: mark_user_engines_stale ───────────────────────────────────────────

def mark_user_engines_stale(**kwargs):
    """
    Mark multi_currency (Group B) stale for users who hold non-AUD securities.
    Lazy — no DAG is triggered; recalculation happens when the user next hits the API.
    """
    ti = kwargs["ti"]
    updated_pairs = ti.xcom_pull(task_ids="load_raw_fx_rates", key="updated_pairs") or []

    if not updated_pairs:
        return

    client = _supabase()

    # Find users holding securities whose currency was updated
    updated_currencies = [pair.split("_")[0] for pair in updated_pairs]
    try:
        res = (
            client.table("activities")
            .select("user_id, securities!inner(currency)")
            .eq("type", "BUY")
            .in_("securities.currency", updated_currencies)
            .execute()
        )
        affected_users = list({r["user_id"] for r in (res.data or []) if r.get("user_id")})
    except Exception as exc:
        print(f"Could not find affected users: {exc}")
        return

    if not affected_users:
        print("No users hold non-AUD securities — nothing to mark stale")
        return

    upsert_rows = [
        {
            "user_id": uid,
            "engine_name": eng,
            "is_stale": True,
            "stale_reason": "fx_update",
        }
        for uid in affected_users
        for eng in _FX_DEPENDENT_ENGINES
    ]

    client.table("engine_run_state").upsert(
        upsert_rows,
        on_conflict="user_id,engine_name",
    ).execute()

    print(
        f"Marked multi_currency stale for {len(affected_users)} users "
        f"(currencies: {updated_currencies})"
    )


# ── DAG definition ─────────────────────────────────────────────────────────────

default_args = {
    "owner": "nexgen",
    "retries": 2,
    "retry_delay": 60,
    "on_failure_callback": _on_fx_fetch_failure,
}

with DAG(
    dag_id="scheduled_fx_rate_dag",
    default_args=default_args,
    description="Fetch FX rates (to AUD) every hour; mark multi_currency engine stale for affected users",
    schedule_interval="0 */1 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["market-data", "scheduled", "fx"],
) as dag:

    t1 = PythonOperator(
        task_id="get_active_currencies",
        python_callable=get_active_currencies,
    )

    t2 = PythonOperator(
        task_id="fetch_fx_rates",
        python_callable=fetch_fx_rates,
        on_failure_callback=_on_fx_fetch_failure,
    )

    t3 = PythonOperator(
        task_id="validate_fx_data",
        python_callable=validate_fx_data,
        trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
    )

    t4 = PythonOperator(
        task_id="load_raw_fx_rates",
        python_callable=load_raw_fx_rates,
    )

    t5_dbt = BashOperator(
        task_id="run_dbt_fx_models",
        bash_command=(
            f"cd {_DBT_DIR} && "
            f"dbt run --select stg_fx_rates int_latest_fx_rates "
            f"--target-path {_DBT_TARGET_DIR}"
        ),
    )

    t6 = PythonOperator(
        task_id="flag_fx_freshness",
        python_callable=flag_fx_freshness,
    )

    t7 = PythonOperator(
        task_id="mark_user_engines_stale",
        python_callable=mark_user_engines_stale,
    )

    t1 >> t2 >> t3 >> t4 >> t5_dbt >> t6 >> t7
