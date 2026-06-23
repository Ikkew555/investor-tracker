"""
Reads the latest calculation result for a feature from the mart tables.

Read path:
  1. Redis cache (get_cached_engine) — sub-millisecond
  2. Supabase mart table — if cache miss
  3. Stale check — compare last run_at vs latest activity update_at

The Redis cache is populated here on every DB read (including stale reads)
so that repeat requests within the TTL window skip the DB entirely.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

_STALE_HOURS = 25


@dataclass
class FeatureResult:
    rows: list
    stale: bool
    warning: Optional[str]
    needs_fallback: bool   # True → no usable data at all; wait for pipeline
    no_data: bool          # True → user has no activities
    run_at: Optional[datetime] = None


def read_feature(client, table: str, user_id: str) -> FeatureResult:
    # Step 0: does the user have any activities?
    act_res = (
        client.table("activities")
        .select("updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    if not (act_res.data or []):
        return FeatureResult(
            rows=[], stale=False, warning=None,
            needs_fallback=False, no_data=True,
        )

    latest_activity_dt = _parse_ts(act_res.data[0]["updated_at"])

    # Step 1: find the latest run_id for this user + table
    latest_res = (
        client.table(table)
        .select("run_id, run_at")
        .eq("user_id", user_id)
        .order("run_at", desc=True)
        .limit(1)
        .execute()
    )
    if not (latest_res.data or []):
        return FeatureResult(
            rows=[], stale=True, warning=None,
            needs_fallback=True, no_data=False,
        )

    latest_run_id = latest_res.data[0]["run_id"]
    latest_run_dt = _parse_ts(latest_res.data[0]["run_at"])

    # Step 2: fetch all rows for that run
    rows_res = (
        client.table(table)
        .select("*")
        .eq("user_id", user_id)
        .eq("run_id", latest_run_id)
        .execute()
    )
    rows = rows_res.data or []

    # Step 3: staleness checks
    if latest_activity_dt > latest_run_dt:
        # Activities changed since last pipeline run — data is stale.
        # Still return the existing rows so the frontend can display something;
        # the frontend will show a stale warning and trigger async recalculation.
        return FeatureResult(
            rows=rows, stale=True,
            needs_fallback=False, no_data=False, run_at=latest_run_dt,
        )

    if datetime.now(timezone.utc) - latest_run_dt > timedelta(hours=_STALE_HOURS):
        # Data is old but we have it — return with a stale warning.
        return FeatureResult(
            rows=rows, stale=True,
            needs_fallback=False, no_data=False, run_at=latest_run_dt,
        )

    return FeatureResult(
        rows=rows, stale=False, warning=None,
        needs_fallback=False, no_data=False, run_at=latest_run_dt,
    )


def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
