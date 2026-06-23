"""
Scheduled dividend and franking data ingestion pipeline.

Schedule:  0 7 * * *  (7:00 AM Melbourne, daily — before ASX market open)
Timezone:  Australia/Melbourne

Fetches dividend announcements from Yahoo Finance quoteSummary for all securities
that have a dividend_rate > 0 in int_latest_prices. Stores results in raw_dividend_data,
then runs dbt to build int_upcoming_dividends for the future_income and calendar engines.

Task graph:
  get_symbols_with_dividends   (int_latest_prices WHERE dividend_rate > 0)
        ↓
  fetch_dividend_announcements  (Yahoo Finance quoteSummary: exDividendDate, dividendRate)
        ↓  (trigger_rule=NONE_FAILED_MIN_ONE_SUCCESS)
  validate_dividend_data
        ↓
  load_raw_dividend_data        (upsert by symbol+ex_date — idempotent daily re-fetch)
        ↓
  run_dbt_dividend_models       (stg_dividend_data → int_dividend_frequency → int_upcoming_dividends)
        ↓
  flag_dividend_freshness
        ↓
  mark_user_engines_stale       (future_income + calendar for users holding updated symbols)

Franking credits:
  Yahoo Finance does not provide franking percentages. We default to 100% for ASX-listed
  securities and 0% for all others. When accurate franking data is available (e.g. from
  ASX company announcements or a third-party feed), update raw_dividend_data.franking_pct
  directly and re-run the dbt models.
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import requests
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.trigger_rule import TriggerRule

sys.path.insert(0, "/opt/airflow")

from supabase import create_client

_DBT_DIR = "/opt/airflow/dbt"
_DBT_TARGET_DIR = "/tmp/dbt_target"

# Group C + calendar (Group D) depend on dividend data
_DIVIDEND_DEPENDENT_ENGINES = ["future_income", "calendar"]

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

_EXCHANGE_SUFFIXES = {
    "ASX": ".AX", "NYSE": "", "NASDAQ": "", "LSE": ".L",
    "TSE": ".T", "HKEX": ".HK", "TSX": ".TO",
}


def _supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


def _on_div_fetch_failure(context):
    try:
        client = _supabase()
        client.table("data_freshness").upsert(
            [{
                "data_type": "dividend",
                "symbol": None,
                "currency_pair": None,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "is_stale": True,
                "fetch_status": "failed",
                "error_detail": str(context.get("exception", "unknown"))[:500],
            }],
            on_conflict="data_type,symbol,currency_pair",
        ).execute()
    except Exception as exc:
        print(f"[on_failure] Could not write dividend failure to data_freshness: {exc}")


# ── task 1: get_symbols_with_dividends ────────────────────────────────────────

def get_symbols_with_dividends(**kwargs):
    """
    Query int_latest_prices for symbols that have dividend_rate > 0.
    Also retrieve their exchange so we can build the correct Yahoo ticker.
    Falls back to all securities if int_latest_prices is not yet populated.
    """
    ti = kwargs["ti"]
    client = _supabase()

    # Primary: use dbt intermediate view — symbols known to pay dividends
    try:
        res = (
            client.table("int_latest_prices")
            .select("symbol, exchange")
            .gt("dividend_rate", 0)
            .execute()
        )
        securities = [{"symbol": r["symbol"], "exchange": r.get("exchange")} for r in (res.data or [])]
    except Exception:
        # Fallback: all securities
        res = client.table("securities").select("symbol, exchange").execute()
        securities = [{"symbol": r["symbol"], "exchange": r.get("exchange")} for r in (res.data or [])]

    ti.xcom_push(key="securities", value=securities)
    print(f"Found {len(securities)} symbols with dividend_rate > 0")


# ── task 2: fetch_dividend_announcements ──────────────────────────────────────

def fetch_dividend_announcements(**kwargs):
    """
    For each symbol, call Yahoo Finance quoteSummary to get:
      - exDividendDate (next or most recent ex-date)
      - dividendRate  (annual DPS in local currency)
      - dividendYield

    Returns one row per symbol per ex_date found.
    """
    ti = kwargs["ti"]
    securities = ti.xcom_pull(task_ids="get_symbols_with_dividends", key="securities") or []

    rows = []
    now = datetime.now(timezone.utc).isoformat()

    for sec in securities:
        symbol = sec.get("symbol", "")
        exchange = sec.get("exchange", "")
        suffix = _EXCHANGE_SUFFIXES.get(exchange, "")
        yahoo_ticker = f"{symbol}{suffix}"

        url = (
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{yahoo_ticker}"
            "?modules=summaryDetail,defaultKeyStatistics"
        )
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=15)
            if resp.status_code != 200:
                print(f"Dividend {yahoo_ticker}: HTTP {resp.status_code}")
                time.sleep(0.1)
                continue

            qs = resp.json().get("quoteSummary", {})
            result = (qs.get("result") or [None])[0]
            if not result:
                time.sleep(0.1)
                continue

            summary = result.get("summaryDetail", {})
            stats = result.get("defaultKeyStatistics", {})

            ex_date_raw = summary.get("exDividendDate", {})
            ex_date_ts = ex_date_raw.get("raw") if isinstance(ex_date_raw, dict) else None
            if ex_date_ts:
                from datetime import datetime as dt
                ex_date = dt.utcfromtimestamp(ex_date_ts).strftime("%Y-%m-%d")
            else:
                ex_date = None

            div_rate_raw = summary.get("dividendRate", {})
            div_rate = div_rate_raw.get("raw") if isinstance(div_rate_raw, dict) else div_rate_raw

            if div_rate and float(div_rate) > 0:
                is_asx = exchange == "ASX" or suffix == ".AX"
                rows.append({
                    "symbol": symbol,
                    "ex_date": ex_date,
                    "payment_date": None,         # Yahoo doesn't provide payment date reliably
                    "amount": float(div_rate) / 4 if ex_date else float(div_rate),  # rough quarterly DPS
                    "dividend_type": "regular",
                    "franking_pct": 100.0 if is_asx else 0.0,  # conservative default for ASX
                    "currency": "AUD" if is_asx else "USD",
                    "source": "yahoo_finance",
                    "fetched_at": now,
                })
                print(f"Dividend {yahoo_ticker}: rate={div_rate}, ex_date={ex_date}")

            time.sleep(0.15)

        except Exception as exc:
            print(f"Dividend {yahoo_ticker}: fetch error — {exc}")
            time.sleep(0.1)

    ti.xcom_push(key="dividend_rows", value=rows)
    print(f"Fetched {len(rows)} dividend rows from {len(securities)} symbols")


# ── task 3: validate_dividend_data ────────────────────────────────────────────

def validate_dividend_data(**kwargs):
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="fetch_dividend_announcements", key="dividend_rows") or []

    valid = [r for r in rows if r.get("amount") and float(r["amount"]) > 0]
    print(f"Dividend validation: {len(valid)} valid rows (of {len(rows)})")
    ti.xcom_push(key="valid_dividend_rows", value=valid)


# ── task 4: load_raw_dividend_data ────────────────────────────────────────────

def load_raw_dividend_data(**kwargs):
    """
    Upsert into raw_dividend_data by (symbol, ex_date).
    Idempotent: daily re-runs update existing rows rather than creating duplicates.
    Rows with ex_date=NULL are inserted as new (we can't dedup them reliably).
    """
    ti = kwargs["ti"]
    rows = ti.xcom_pull(task_ids="validate_dividend_data", key="valid_dividend_rows") or []

    if not rows:
        print("No valid dividend rows to save")
        ti.xcom_push(key="updated_symbols", value=[])
        return

    client = _supabase()

    rows_with_exdate = [r for r in rows if r.get("ex_date")]
    rows_no_exdate = [r for r in rows if not r.get("ex_date")]

    if rows_with_exdate:
        client.table("raw_dividend_data").upsert(
            rows_with_exdate,
            on_conflict="symbol,ex_date",
        ).execute()

    if rows_no_exdate:
        client.table("raw_dividend_data").insert(rows_no_exdate).execute()

    updated_symbols = list({r["symbol"] for r in rows if r.get("symbol")})
    ti.xcom_push(key="updated_symbols", value=updated_symbols)
    print(f"Upserted {len(rows)} dividend rows for {len(updated_symbols)} symbols")


# ── task 5: flag_dividend_freshness ───────────────────────────────────────────

def flag_dividend_freshness(**kwargs):
    ti = kwargs["ti"]
    updated_symbols = ti.xcom_pull(task_ids="load_raw_dividend_data", key="updated_symbols") or []

    if not updated_symbols:
        return

    client = _supabase()
    now = datetime.now(timezone.utc).isoformat()
    freshness_rows = [
        {
            "data_type": "dividend",
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
    print(f"Flagged dividend freshness for {len(updated_symbols)} symbols")


# ── task 6: mark_user_engines_stale ───────────────────────────────────────────

def mark_user_engines_stale(**kwargs):
    """
    Mark future_income (Group C) and calendar (Group D) stale
    for users who hold securities whose dividend data was updated.
    """
    ti = kwargs["ti"]
    updated_symbols = ti.xcom_pull(task_ids="load_raw_dividend_data", key="updated_symbols") or []

    if not updated_symbols:
        return

    client = _supabase()

    try:
        result = client.rpc(
            "get_users_holding_symbols",
            {"p_symbols": updated_symbols},
        ).execute()
        affected_users = [r["user_id"] for r in (result.data or [])]
    except Exception as exc:
        print(f"RPC failed ({exc}), falling back to activities query")
        res = (
            client.table("activities")
            .select("user_id, securities!inner(symbol)")
            .eq("type", "BUY")
            .in_("securities.symbol", updated_symbols)
            .execute()
        )
        affected_users = list({r["user_id"] for r in (res.data or []) if r.get("user_id")})

    if not affected_users:
        return

    upsert_rows = [
        {
            "user_id": uid,
            "engine_name": eng,
            "is_stale": True,
            "stale_reason": "dividend_update",
        }
        for uid in affected_users
        for eng in _DIVIDEND_DEPENDENT_ENGINES
    ]

    chunk_size = 500
    for i in range(0, len(upsert_rows), chunk_size):
        client.table("engine_run_state").upsert(
            upsert_rows[i:i + chunk_size],
            on_conflict="user_id,engine_name",
        ).execute()

    print(
        f"Marked {_DIVIDEND_DEPENDENT_ENGINES} stale for {len(affected_users)} users"
    )


# ── DAG definition ─────────────────────────────────────────────────────────────

default_args = {
    "owner": "nexgen",
    "retries": 1,
    "retry_delay": 300,  # 5 min before retrying daily fetch
    "on_failure_callback": _on_div_fetch_failure,
}

with DAG(
    dag_id="scheduled_dividend_franking_dag",
    default_args=default_args,
    description="Fetch dividend announcements daily at 7 AM Melbourne; mark future_income and calendar engines stale",
    schedule_interval="0 7 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["market-data", "scheduled", "dividends"],
    params={"timezone": "Australia/Melbourne"},
) as dag:

    t1 = PythonOperator(
        task_id="get_symbols_with_dividends",
        python_callable=get_symbols_with_dividends,
    )

    t2 = PythonOperator(
        task_id="fetch_dividend_announcements",
        python_callable=fetch_dividend_announcements,
        on_failure_callback=_on_div_fetch_failure,
    )

    t3 = PythonOperator(
        task_id="validate_dividend_data",
        python_callable=validate_dividend_data,
        trigger_rule=TriggerRule.NONE_FAILED_MIN_ONE_SUCCESS,
    )

    t4 = PythonOperator(
        task_id="load_raw_dividend_data",
        python_callable=load_raw_dividend_data,
    )

    t5_dbt = BashOperator(
        task_id="run_dbt_dividend_models",
        bash_command=(
            f"cd {_DBT_DIR} && "
            f"dbt run --select stg_dividend_data int_dividend_frequency int_upcoming_dividends "
            f"--target-path {_DBT_TARGET_DIR}"
        ),
    )

    t6 = PythonOperator(
        task_id="flag_dividend_freshness",
        python_callable=flag_dividend_freshness,
    )

    t7 = PythonOperator(
        task_id="mark_user_engines_stale",
        python_callable=mark_user_engines_stale,
    )

    t1 >> t2 >> t3 >> t4 >> t5_dbt >> t6 >> t7
