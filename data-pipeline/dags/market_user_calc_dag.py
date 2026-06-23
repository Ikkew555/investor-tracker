"""
market_user_calc_dag — Groups A + B + C engines:
    performance, contribution_analysis, multi_period,  (Group A)
    future_income,                                      (Group C)
    multi_currency.                                     (Group B)

All 5 engines run in parallel via ThreadPoolExecutor — they share inputs
but produce independent outputs with no cross-dependency.

Triggered in parallel with tax_user_calc_dag by POST /api/refresh/{user_id}.
Expected wall time: 20-25 s (vs 45-90 s in the old monolithic DAG).

Key improvements over on_demand_user_calculation_dag:
  - All 5 market-data engines run in parallel threads (no sequential for-loop).
  - Mart writes parallelised (5 concurrent Supabase inserts).
  - Inputs stored in Redis instead of XCom (shared with tax_user_calc_dag
    if both are triggered simultaneously for the same run_id).
  - check_prices_fresh + check_fx_fresh merged into load_inputs
    (informational only — engines proceed regardless of freshness).
  - 3 finalisation tasks merged into 1.
  - dbt models filtered to this user_id only.
"""

import hashlib
import json
import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.trigger_rule import TriggerRule

sys.path.insert(0, "/opt/airflow")

from supabase import create_client

_MARKET_ENGINES = [
    "performance", "contribution_analysis", "multi_period",  # Group A
    "future_income",                                          # Group C
    "multi_currency",                                         # Group B
]

_TABLE_MAP = {
    "performance":           "mart_performance",
    "contribution_analysis": "mart_contribution_analysis",
    "multi_period":          "mart_multi_period",
    "future_income":         "mart_future_income",
    "multi_currency":        "mart_multi_currency",
}

_ENGINE_REDIS_TTL = {
    "performance":           1200,
    "contribution_analysis": 1200,
    "multi_period":          1200,
    "future_income":         43200,
    "multi_currency":        1200,
}

_PRICE_MAX_AGE_SECONDS = 1200
_FX_MAX_AGE_SECONDS    = 3900


def _supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )


def _get_redis():
    try:
        import redis
        return redis.Redis(
            host=os.environ.get("REDIS_HOST", "redis"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            decode_responses=True,
            socket_timeout=2,
        )
    except Exception:
        return None


def _inputs_hash(inputs: dict) -> str:
    payload = json.dumps(
        {k: inputs[k] for k in ("parcels", "disposals", "dividends", "entity_type") if k in inputs},
        sort_keys=True, default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


# ── task 1: setup ─────────────────────────────────────────────────────────────

def setup(**kwargs):
    ti = kwargs["ti"]
    conf = kwargs["dag_run"].conf or {}
    user_id = conf.get("user_id") or os.environ.get("TEST_USER_ID", "")
    if not user_id:
        raise ValueError("No user_id in DAG conf")

    requested = conf.get("engines", ["all"])
    if requested == ["all"] or "all" in requested:
        requested = _MARKET_ENGINES
    else:
        requested = [e for e in requested if e in _MARKET_ENGINES]

    run_id = str(uuid.uuid4())
    ti.xcom_push(key="user_id",           value=user_id)
    ti.xcom_push(key="run_id",            value=run_id)
    ti.xcom_push(key="requested_engines", value=requested)
    print(f"[market_dag] setup | user={user_id} run={run_id} engines={requested}")


# ── task 3: load inputs + staleness + data freshness check ───────────────────

def load_inputs(**kwargs):
    ti = kwargs["ti"]
    user_id   = ti.xcom_pull(task_ids="setup", key="user_id")
    run_id    = ti.xcom_pull(task_ids="setup", key="run_id")
    requested = ti.xcom_pull(task_ids="setup", key="requested_engines")

    from calculations.main import _load_inputs
    client = _supabase()
    inputs = _load_inputs(client, user_id)

    h = _inputs_hash(inputs)
    ti.xcom_push(key="inputs_hash", value=h)

    # Store large inputs in Redis; fall back to XCom if Redis unavailable
    r = _get_redis()
    inputs_key = f"dag_inputs:{run_id}"
    if r:
        try:
            r.setex(inputs_key, 3600, json.dumps(inputs, default=str))
            ti.xcom_push(key="inputs_key",     value=inputs_key)
            ti.xcom_push(key="inputs_in_redis", value=True)
            print(f"[market_dag] inputs stored in Redis key={inputs_key}")
        except Exception as exc:
            print(f"[market_dag] Redis write failed ({exc}) — falling back to XCom")
            ti.xcom_push(key="inputs",          value=inputs)
            ti.xcom_push(key="inputs_in_redis", value=False)
    else:
        ti.xcom_push(key="inputs",          value=inputs)
        ti.xcom_push(key="inputs_in_redis", value=False)

    # Staleness check (informational — engines run with best-available data)
    res = (
        client.table("engine_run_state")
        .select("engine_name, is_stale")
        .eq("user_id", user_id)
        .in_("engine_name", requested)
        .execute()
    )
    known = {r["engine_name"]: r["is_stale"] for r in (res.data or [])}
    stale_map = {e: known.get(e, True) for e in requested}
    ti.xcom_push(key="stale_map", value=stale_map)

    # Price / FX freshness — log only, never block execution
    _log_data_freshness(client)

    stale = [e for e, s in stale_map.items() if s]
    skip  = [e for e, s in stale_map.items() if not s]
    print(f"[market_dag] parcels={len(inputs['parcels'])} disposals={len(inputs['disposals'])} hash={h[:8]}")
    print(f"[market_dag] stale={stale} skip={skip}")


def _log_data_freshness(client):
    """Log price + FX freshness — informational, never blocks execution."""
    for data_type, max_age in [("market_price", _PRICE_MAX_AGE_SECONDS), ("fx_rate", _FX_MAX_AGE_SECONDS)]:
        try:
            res = (
                client.table("data_freshness")
                .select("last_updated, is_stale")
                .eq("data_type", data_type)
                .eq("is_stale", False)
                .order("last_updated", desc=True)
                .limit(1)
                .execute()
            )
            if res.data:
                last_dt = datetime.fromisoformat(res.data[0]["last_updated"].replace("Z", "+00:00"))
                age_s = (datetime.now(timezone.utc) - last_dt).total_seconds()
                label = "fresh" if age_s < max_age else "stale (proceeding anyway)"
                print(f"[market_dag] {data_type}: last updated {int(age_s)}s ago — {label}")
        except Exception:
            pass


def _get_inputs(ti) -> dict:
    in_redis = ti.xcom_pull(task_ids="load_inputs", key="inputs_in_redis")
    if in_redis:
        run_id = ti.xcom_pull(task_ids="setup", key="run_id")
        r = _get_redis()
        if r:
            raw = r.get(f"dag_inputs:{run_id}")
            if raw:
                return json.loads(raw)
    return ti.xcom_pull(task_ids="load_inputs", key="inputs") or {}


# ── task 4: run all 5 market engines in parallel ──────────────────────────────

def run_market_engines_parallel(**kwargs):
    ti = kwargs["ti"]
    user_id   = ti.xcom_pull(task_ids="setup",       key="user_id")
    run_id    = ti.xcom_pull(task_ids="setup",       key="run_id")
    stale_map = ti.xcom_pull(task_ids="load_inputs", key="stale_map") or {}
    inputs    = _get_inputs(ti)

    from calculations import (
        performance, contribution_analysis, multi_period,
        future_income, multi_currency,
    )

    engine_fns = {
        "performance":           performance.calculate,
        "contribution_analysis": contribution_analysis.calculate,
        "multi_period":          multi_period.calculate,
        "future_income":         future_income.calculate,
        "multi_currency":        multi_currency.calculate,
    }

    engines_to_run = {
        name: fn for name, fn in engine_fns.items()
        if stale_map.get(name, True)
    }

    if not engines_to_run:
        print("[market_dag] all market engines fresh — skipping")
        ti.xcom_push(key="mart_rows", value={})
        ti.xcom_push(key="completed", value=[])
        return

    mart_rows = {}
    completed = []
    errors    = []

    # All 5 engines share the same inputs and produce independent outputs —
    # no data dependency between them, safe to run fully in parallel.
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(fn, user_id, run_id, inputs): name
            for name, fn in engines_to_run.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                rows = future.result()
                mart_rows[_TABLE_MAP[name]] = rows
                completed.append(name)
                print(f"[market_dag] {name} done — {len(rows)} rows")
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                print(f"[market_dag] {name} FAILED — {exc}")

    if errors:
        raise RuntimeError(f"Market engine failures: {errors}")

    ti.xcom_push(key="mart_rows", value=mart_rows)
    ti.xcom_push(key="completed", value=completed)
    print(f"[market_dag] all market engines complete | engines={completed}")


# ── task 5: write mart tables in parallel ─────────────────────────────────────

def write_marts_parallel(**kwargs):
    ti = kwargs["ti"]
    run_id    = ti.xcom_pull(task_ids="setup",                 key="run_id")
    mart_rows = ti.xcom_pull(task_ids="run_market_engines",    key="mart_rows") or {}

    if not mart_rows:
        print("[market_dag] no mart rows to write")
        return

    client = _supabase()
    total  = 0
    errors = []

    def _insert_table(table, rows, chunk_size=200, retries=3):
        import time
        for i in range(0, len(rows), chunk_size):
            chunk = rows[i:i + chunk_size]
            for attempt in range(retries):
                try:
                    client.table(table).insert(chunk).execute()
                    break
                except Exception as exc:
                    if attempt < retries - 1:
                        time.sleep(2 ** attempt)  # 1s, 2s backoff
                    else:
                        raise exc
        return len(rows)

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            pool.submit(_insert_table, table, rows): (table, len(rows))
            for table, rows in mart_rows.items() if rows
        }
        for future in as_completed(futures):
            table, count = futures[future]
            try:
                future.result()
                total += count
                print(f"[market_dag] inserted {count} rows → {table}")
            except Exception as exc:
                errors.append(f"{table}: {exc}")
                print(f"[market_dag] insert FAILED {table} — {exc}")

    if errors:
        raise RuntimeError(f"Mart write failures: {errors}")

    print(f"[market_dag] total {total} rows written (run_id={run_id})")


# ── task 6: finalize ──────────────────────────────────────────────────────────

def finalize(**kwargs):
    ti = kwargs["ti"]
    user_id     = ti.xcom_pull(task_ids="setup",               key="user_id")
    run_id      = ti.xcom_pull(task_ids="setup",               key="run_id")
    inputs_hash = ti.xcom_pull(task_ids="load_inputs",         key="inputs_hash") or ""
    completed   = ti.xcom_pull(task_ids="run_market_engines",  key="completed")   or []

    if not completed:
        print("[market_dag] no engines completed — nothing to finalise")
        return

    client = _supabase()
    now = datetime.now(timezone.utc).isoformat()
    client.table("engine_run_state").upsert(
        [
            {
                "user_id":      user_id,
                "engine_name":  eng,
                "last_run_id":  run_id,
                "last_run_at":  now,
                "is_stale":     False,
                "stale_reason": None,
                "inputs_hash":  inputs_hash,
            }
            for eng in completed
        ],
        on_conflict="user_id,engine_name",
    ).execute()

    r = _get_redis()
    if r:
        for eng in completed:
            try:
                r.delete(f"engine:{user_id}:{eng}")
            except Exception as exc:
                print(f"[market_dag] Redis flush {eng} failed: {exc}")
        if ti.xcom_pull(task_ids="load_inputs", key="inputs_in_redis"):
            try:
                r.delete(f"dag_inputs:{run_id}")
            except Exception:
                pass

    print(f"[market_dag] finalised | user={user_id} run={run_id} engines={completed} at={now}")


# ── DAG definition ─────────────────────────────────────────────────────────────

with DAG(
    dag_id="market_user_calc_dag",
    default_args={"owner": "nexgen", "retries": 1},
    description=(
        "Market-data engines: performance, contribution_analysis, multi_period, "
        "future_income, multi_currency. All run in parallel. ~20-25 s. "
        "Triggered in parallel with tax_user_calc_dag."
    ),
    schedule_interval=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=32,
    tags=["calculations", "user-triggered", "market"],
) as dag:

    # No dbt task needed: stg_activities, int_parcels, int_disposals, int_dividends
    # are VIEWs over the activities table — always fresh on every SELECT.
    # int_securities_meta is also a VIEW. int_latest_prices and int_latest_fx_rates
    # are rebuilt by their scheduled DAGs every 15 min / hourly respectively.
    # Running dbt here would trigger Supabase's RLS hook which cannot enable RLS on views.

    t1_setup   = PythonOperator(task_id="setup",               python_callable=setup)
    t2_inputs  = PythonOperator(task_id="load_inputs",         python_callable=load_inputs)
    t3_engines = PythonOperator(task_id="run_market_engines",  python_callable=run_market_engines_parallel)
    t4_write   = PythonOperator(
        task_id="write_marts",
        python_callable=write_marts_parallel,
        trigger_rule=TriggerRule.ALL_DONE,
    )
    t5_final   = PythonOperator(task_id="finalize", python_callable=finalize)

    t1_setup >> t2_inputs >> t3_engines >> t4_write >> t5_final
