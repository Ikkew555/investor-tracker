"""
tax_user_calc_dag — Group D engines only: tax, sold_securities, calendar.

No market-data dependency — these are the fastest engines and produce
the data for the Tax, Sold Securities, and Calendar tool pages.

Triggered in parallel with market_user_calc_dag by POST /api/refresh/{user_id}.
Expected wall time: 10-15 s (vs 45-90 s in the old monolithic DAG).

Key improvements over on_demand_user_calculation_dag:
  - All 3 Group D engines run in parallel via ThreadPoolExecutor.
  - Mart writes are parallelised (3 concurrent Supabase inserts).
  - Large inputs dict stored in Redis instead of Airflow XCom (avoids
    Postgres metadata DB bloat on accounts with many activities).
  - 3 finalisation tasks merged into 1 (state update + Redis flush + log).
  - dbt models filtered to this user_id only — no full-table rebuild.
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

_GROUP_D_ENGINES = ["sold_securities", "tax", "calendar"]

_TABLE_MAP = {
    "sold_securities": "mart_sold_securities",
    "calendar":        "mart_calendar_events",
    # tax returns a dict of 4 tables — handled separately
}

_ENGINE_REDIS_TTL = {
    "sold_securities": 86400,
    "tax":             86400,
    "calendar":        86400,
}


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
        requested = _GROUP_D_ENGINES
    else:
        requested = [e for e in requested if e in _GROUP_D_ENGINES]

    run_id = str(uuid.uuid4())
    ti.xcom_push(key="user_id",            value=user_id)
    ti.xcom_push(key="run_id",             value=run_id)
    ti.xcom_push(key="requested_engines",  value=requested)
    print(f"[tax_dag] setup | user={user_id} run={run_id} engines={requested}")


# ── task 2: dbt (user-scoped) ─────────────────────────────────────────────────
# Defined inline as BashOperator below — user_id templated from XCom.


# ── task 3: load inputs ───────────────────────────────────────────────────────

def load_inputs(**kwargs):
    ti = kwargs["ti"]
    user_id = ti.xcom_pull(task_ids="setup", key="user_id")
    run_id  = ti.xcom_pull(task_ids="setup", key="run_id")

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
            ti.xcom_push(key="inputs_key",    value=inputs_key)
            ti.xcom_push(key="inputs_in_redis", value=True)
            print(f"[tax_dag] inputs stored in Redis key={inputs_key}")
        except Exception as exc:
            print(f"[tax_dag] Redis write failed ({exc}) — falling back to XCom")
            ti.xcom_push(key="inputs",         value=inputs)
            ti.xcom_push(key="inputs_in_redis", value=False)
    else:
        ti.xcom_push(key="inputs",          value=inputs)
        ti.xcom_push(key="inputs_in_redis", value=False)

    # Staleness check
    requested = ti.xcom_pull(task_ids="setup", key="requested_engines")
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

    stale = [e for e, s in stale_map.items() if s]
    skip  = [e for e, s in stale_map.items() if not s]
    print(f"[tax_dag] parcels={len(inputs['parcels'])} disposals={len(inputs['disposals'])} hash={h[:8]}")
    print(f"[tax_dag] stale={stale} skip={skip}")


def _get_inputs(ti) -> dict:
    """Retrieve inputs from Redis or XCom."""
    in_redis = ti.xcom_pull(task_ids="load_inputs", key="inputs_in_redis")
    if in_redis:
        run_id = ti.xcom_pull(task_ids="setup", key="run_id")
        r = _get_redis()
        if r:
            raw = r.get(f"dag_inputs:{run_id}")
            if raw:
                return json.loads(raw)
    return ti.xcom_pull(task_ids="load_inputs", key="inputs") or {}


# ── task 4: run Group D engines in parallel ───────────────────────────────────

def run_group_D_parallel(**kwargs):
    ti = kwargs["ti"]
    user_id   = ti.xcom_pull(task_ids="setup",       key="user_id")
    run_id    = ti.xcom_pull(task_ids="setup",       key="run_id")
    stale_map = ti.xcom_pull(task_ids="load_inputs", key="stale_map") or {}
    inputs    = _get_inputs(ti)

    from calculations import sold_securities, tax, calendar as cal

    engine_fns = {
        "sold_securities": sold_securities.calculate,
        "tax":             tax.calculate,
        "calendar":        cal.calculate,
    }

    engines_to_run = {
        name: fn for name, fn in engine_fns.items()
        if stale_map.get(name, True)
    }
    if not engines_to_run:
        print("[tax_dag] all Group D engines fresh — skipping")
        ti.xcom_push(key="mart_rows",  value={})
        ti.xcom_push(key="completed",  value=[])
        return

    mart_rows = {}
    completed = []
    errors    = []

    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {
            pool.submit(fn, user_id, run_id, inputs): name
            for name, fn in engines_to_run.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                result = future.result()
                if isinstance(result, dict):
                    mart_rows.update(result)         # tax returns {table: rows}
                else:
                    mart_rows[_TABLE_MAP[name]] = result
                completed.append(name)
                row_count = sum(len(v) for v in result.values()) if isinstance(result, dict) else len(result)
                print(f"[tax_dag] {name} done — {row_count} rows")
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                print(f"[tax_dag] {name} FAILED — {exc}")

    if errors:
        raise RuntimeError(f"Group D engine failures: {errors}")

    ti.xcom_push(key="mart_rows", value=mart_rows)
    ti.xcom_push(key="completed", value=completed)
    print(f"[tax_dag] Group D complete | engines={completed}")


# ── task 5: write mart tables in parallel ─────────────────────────────────────

def write_marts_parallel(**kwargs):
    ti = kwargs["ti"]
    run_id    = ti.xcom_pull(task_ids="setup",            key="run_id")
    mart_rows = ti.xcom_pull(task_ids="run_group_D",      key="mart_rows") or {}

    if not mart_rows:
        print("[tax_dag] no mart rows to write")
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
                print(f"[tax_dag] inserted {count} rows → {table}")
            except Exception as exc:
                errors.append(f"{table}: {exc}")
                print(f"[tax_dag] insert FAILED {table} — {exc}")

    if errors:
        raise RuntimeError(f"Mart write failures: {errors}")

    print(f"[tax_dag] total {total} rows written (run_id={run_id})")


# ── task 6: finalize (state + Redis flush + log) ──────────────────────────────

def finalize(**kwargs):
    ti = kwargs["ti"]
    user_id     = ti.xcom_pull(task_ids="setup",       key="user_id")
    run_id      = ti.xcom_pull(task_ids="setup",       key="run_id")
    inputs_hash = ti.xcom_pull(task_ids="load_inputs", key="inputs_hash") or ""
    completed   = ti.xcom_pull(task_ids="run_group_D", key="completed")  or []

    if not completed:
        print("[tax_dag] no engines completed — nothing to finalise")
        return

    # Update engine_run_state
    client = _supabase()
    now = datetime.now(timezone.utc).isoformat()
    client.table("engine_run_state").upsert(
        [
            {
                "user_id":     user_id,
                "engine_name": eng,
                "last_run_id": run_id,
                "last_run_at": now,
                "is_stale":    False,
                "stale_reason": None,
                "inputs_hash": inputs_hash,
            }
            for eng in completed
        ],
        on_conflict="user_id,engine_name",
    ).execute()

    # Flush Redis cache so API serves fresh data on next request
    r = _get_redis()
    if r:
        for eng in completed:
            try:
                r.delete(f"engine:{user_id}:{eng}")
            except Exception as exc:
                print(f"[tax_dag] Redis flush {eng} failed: {exc}")

    # Clean up inputs key
    if r and ti.xcom_pull(task_ids="load_inputs", key="inputs_in_redis"):
        try:
            r.delete(f"dag_inputs:{run_id}")
        except Exception:
            pass

    print(f"[tax_dag] finalised | user={user_id} run={run_id} engines={completed} at={now}")


# ── DAG definition ─────────────────────────────────────────────────────────────

with DAG(
    dag_id="tax_user_calc_dag",
    default_args={"owner": "nexgen", "retries": 1},
    description=(
        "Group D engines only (tax, sold_securities, calendar). "
        "No market data needed. Runs in ~10-15 s. "
        "Triggered in parallel with market_user_calc_dag."
    ),
    schedule_interval=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=32,
    tags=["calculations", "user-triggered", "tax"],
) as dag:

    # No dbt task needed: stg_activities, int_parcels, int_disposals, int_dividends
    # are now VIEWs over the activities table — they always return the freshest data
    # on every SELECT without any rebuild step. Running dbt here would:
    #   1. Race with market_user_calc_dag (same views, same CREATE OR REPLACE)
    #   2. Trigger Supabase's RLS hook which cannot enable RLS on views
    # Global models (int_securities_meta, int_latest_prices, int_latest_fx_rates)
    # are maintained by their own scheduled DAGs.

    t1_setup   = PythonOperator(task_id="setup",       python_callable=setup)
    t2_inputs  = PythonOperator(task_id="load_inputs", python_callable=load_inputs)
    t3_group_D = PythonOperator(task_id="run_group_D", python_callable=run_group_D_parallel)
    t4_write   = PythonOperator(
        task_id="write_marts",
        python_callable=write_marts_parallel,
        trigger_rule=TriggerRule.ALL_DONE,
    )
    t5_final   = PythonOperator(task_id="finalize", python_callable=finalize)

    t1_setup >> t2_inputs >> t3_group_D >> t4_write >> t5_final
