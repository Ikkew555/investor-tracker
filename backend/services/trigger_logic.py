"""
Trigger logic for user-initiated events.

Called by the API routes after a transaction is created or deleted to:
  1. Mark all engines stale for that user in engine_run_state.
  2. Flush the user's Redis cache immediately.
  3. Trigger BOTH optimised DAGs in parallel:
       - tax_user_calc_dag    (Group D: tax, sold_securities, calendar)
       - market_user_calc_dag (Groups A+B+C: performance, contribution, ...)

Both DAGs run concurrently. Tax/Calendar pages update in ~10-15 s;
market pages (performance, overview) update in ~20-25 s.

The legacy on_demand_user_calculation_dag is still available as a fallback.
"""

import logging
import os

import httpx

from services.supabase_client import get_client
from services.redis_cache import invalidate_all_user_engines

logger = logging.getLogger(__name__)

_AIRFLOW_URL = os.getenv("AIRFLOW_BASE_URL", "http://airflow-webserver:8080")
_AIRFLOW_USER = os.getenv("AIRFLOW_USER", "admin")
_AIRFLOW_PASSWORD = os.getenv("AIRFLOW_PASSWORD", "admin")

# Optimised split DAGs (preferred)
_TAX_DAG_ID    = "tax_user_calc_dag"
_MARKET_DAG_ID = "market_user_calc_dag"

# Legacy monolithic DAG (kept as fallback)
_LEGACY_DAG_ID = "on_demand_user_calculation_dag"

_ALL_ENGINES = [
    "performance", "contribution_analysis", "multi_period",
    "multi_currency", "future_income",
    "sold_securities", "tax", "calendar",
]

_MART_TABLES = [
    "mart_performance", "mart_contribution_analysis", "mart_multi_period",
    "mart_multi_currency", "mart_future_income", "mart_sold_securities",
    "mart_tax_cgt_events", "mart_tax_dividend_events", "mart_tax_remaining_parcels",
    "mart_tax_summary", "mart_calendar_events",
]


def _clear_user_mart_tables(user_id: str) -> None:
    """
    Delete all mart rows and engine_run_state rows for this user.
    Called when the user has zero remaining activities so stale data
    never surfaces in the UI.
    """
    client = get_client()
    for table in _MART_TABLES:
        try:
            client.table(table).delete().eq("user_id", user_id).execute()
        except Exception as exc:
            logger.error("Failed to clear %s for user %s: %s", table, user_id, exc)
            raise
    try:
        client.table("engine_run_state").delete().eq("user_id", user_id).execute()
        logger.info("Cleared all mart tables and engine_run_state for user %s", user_id)
    except Exception as exc:
        logger.error("Failed to clear engine_run_state for user %s: %s", user_id, exc)
        raise


def _mark_all_engines_stale(user_id: str, reason: str) -> None:
    """
    Upsert engine_run_state rows for all 8 engines, setting is_stale=True.
    Uses the service-role Supabase client (bypasses RLS).
    """
    client = get_client()
    rows = [
        {
            "user_id": user_id,
            "engine_name": eng,
            "is_stale": True,
            "stale_reason": reason,
        }
        for eng in _ALL_ENGINES
    ]

    try:
        client.table("engine_run_state").upsert(
            rows,
            on_conflict="user_id,engine_name",
        ).execute()
        logger.info("Marked all engines stale for user %s (reason: %s)", user_id, reason)
    except Exception as exc:
        logger.error("Failed to mark engines stale for %s: %s", user_id, exc)


def _trigger_single_dag(user_id: str, dag_id: str, engines: list[str]) -> str | None:
    """POST to Airflow REST API to trigger one DAG. Non-fatal on failure."""
    url = f"{_AIRFLOW_URL}/api/v1/dags/{dag_id}/dagRuns"
    try:
        resp = httpx.post(
            url,
            json={"conf": {"user_id": user_id, "engines": engines}},
            auth=(_AIRFLOW_USER, _AIRFLOW_PASSWORD),
            timeout=10,
        )
        resp.raise_for_status()
        dag_run_id = resp.json().get("dag_run_id")
        logger.info("Triggered DAG %s for user %s — dag_run_id=%s", dag_id, user_id, dag_run_id)
        return dag_run_id
    except httpx.HTTPStatusError as exc:
        logger.warning("Airflow trigger failed (%s) for user %s: HTTP %s", dag_id, user_id, exc.response.status_code)
    except httpx.RequestError as exc:
        logger.warning("Airflow unreachable (%s) for user %s: %s", dag_id, user_id, exc)
    return None


def _trigger_calc_dag(user_id: str, engines: list[str] | str = "all") -> None:
    """
    Trigger both optimised DAGs in parallel (tax_user_calc_dag + market_user_calc_dag).
    Falls back to legacy DAG if both new DAGs fail.
    Non-fatal — the user can always retry via POST /api/refresh/{user_id}.
    """
    if engines == "all":
        engines = ["all"]

    tax_run    = _trigger_single_dag(user_id, _TAX_DAG_ID,    engines)
    market_run = _trigger_single_dag(user_id, _MARKET_DAG_ID, engines)

    if not tax_run and not market_run:
        logger.warning("Both new DAGs failed — falling back to legacy DAG for user %s", user_id)
        _trigger_single_dag(user_id, _LEGACY_DAG_ID, engines)


def on_transaction_created(user_id: str) -> None:
    """
    Call after a new BUY, SELL, or DIVIDEND activity is inserted.

    - Marks all engines stale (user data changed).
    - Invalidates Redis cache immediately (next API read fetches from DB).
    - Triggers tax_user_calc_dag AND market_user_calc_dag concurrently.
    """
    _mark_all_engines_stale(user_id, reason="user_transaction")
    invalidate_all_user_engines(user_id)
    _trigger_calc_dag(user_id, engines="all")


def on_transaction_deleted(user_id: str) -> None:
    """
    Call after a BUY, SELL, or DIVIDEND activity is deleted.

    If the user has zero remaining activities, mart tables and engine state
    are cleared immediately and the DAG is NOT triggered (it would abort
    anyway with no data). If activities remain, normal recalc is triggered.
    """
    client = get_client()
    try:
        remaining = (
            client.table("activities")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )
        has_activities = (remaining.count or 0) > 0
    except Exception as exc:
        logger.error("Could not count remaining activities for %s: %s", user_id, exc)
        has_activities = True  # assume data exists; fall back to normal recalc

    if not has_activities:
        _clear_user_mart_tables(user_id)
        invalidate_all_user_engines(user_id)
        logger.info("All activities deleted for user %s — mart tables cleared, DAG skipped", user_id)
    else:
        _mark_all_engines_stale(user_id, reason="user_transaction")
        invalidate_all_user_engines(user_id)
        _trigger_calc_dag(user_id, engines="all")
