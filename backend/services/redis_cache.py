"""
Redis-backed cache for per-engine calculation results.

Cache key schema:
  engine:{user_id}:{engine_name}   →  JSON payload (data, stale, run_at, warning)

TTL per engine group:
  Group D (sold_securities, tax, calendar)         → 86400s (24h)  — changes only on user tx
  Group A (performance, contribution, multi_period) → 1200s  (20m)  — price refresh every 15m
  Group B (multi_currency)                         → 1200s  (20m)  — price + FX refresh every hour
  Group C (future_income)                          → 43200s (12h)  — dividend refresh daily

Failure policy:
  All Redis errors are caught and logged. A cache miss is always safe — the caller
  falls back to a direct Supabase read. Redis is an optimisation layer, not a source
  of truth.
"""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Per-engine TTL in seconds
ENGINE_TTL: dict[str, int] = {
    "sold_securities": 86400,
    "tax": 86400,
    "calendar": 86400,

    "tax_cgt_events": 86400,
    "tax_dividend_events": 86400,
    "tax_dividend_summary": 86400,

    "performance": 1200,
    "performance_history": 1200,
    "contribution_analysis": 1200,
    "multi_period": 1200,
    "multi_currency": 1200,
    "future_income": 43200,
}

_DEFAULT_TTL = 1200

_redis_client = None


def get_redis_client():
    """Return a lazy-initialised Redis client. Returns None if Redis is unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        import redis
        host = os.environ.get("REDIS_HOST", "redis")
        port = int(os.environ.get("REDIS_PORT", 6379))
        client = redis.Redis(
            host=host,
            port=port,
            decode_responses=True,
            socket_timeout=2,
            socket_connect_timeout=2,
        )
        client.ping()   # fail fast at startup if Redis is not reachable
        _redis_client = client
        logger.info("Redis connected at %s:%s", host, port)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — cache disabled", exc)
        _redis_client = None

    return _redis_client


def _cache_key(user_id: str, engine_name: str) -> str:
    return f"engine:{user_id}:{engine_name}"


def get_cached_engine(user_id: str, engine_name: str) -> Optional[dict]:
    """
    Return the cached payload for (user_id, engine_name) or None on miss/error.
    Payload shape: {"data": [...], "stale": bool, "run_at": ISO|None, "warning": str|None}
    """
    r = get_redis_client()
    if r is None:
        return None

    try:
        raw = r.get(_cache_key(user_id, engine_name))
        return json.loads(raw) if raw else None
    except Exception as exc:
        logger.warning("Redis GET failed for %s/%s: %s", user_id, engine_name, exc)
        return None


def set_cached_engine(user_id: str, engine_name: str, payload: dict) -> bool:
    """
    Store payload in Redis with the engine-specific TTL.
    Returns True on success, False on error (non-fatal).
    """
    r = get_redis_client()
    if r is None:
        return False

    ttl = ENGINE_TTL.get(engine_name, _DEFAULT_TTL)
    try:
        r.setex(
            _cache_key(user_id, engine_name),
            ttl,
            json.dumps(payload, default=str),
        )
        return True
    except Exception as exc:
        logger.warning("Redis SET failed for %s/%s: %s", user_id, engine_name, exc)
        return False


def invalidate_user_engines(user_id: str, engine_names: list[str]) -> None:
    """
    Delete Redis keys for the given engines. Called immediately when a user
    adds/deletes a transaction (so the next API read hits the DB, not stale cache).
    """
    r = get_redis_client()
    if r is None:
        return

    keys = [_cache_key(user_id, eng) for eng in engine_names]
    try:
        if keys:
            r.delete(*keys)
            logger.debug("Invalidated Redis keys: %s", keys)
    except Exception as exc:
        logger.warning("Redis DEL failed: %s", exc)


def invalidate_all_user_engines(user_id: str) -> None:
    """Convenience wrapper: invalidate all 8 engines for a user at once."""
    invalidate_user_engines(user_id, list(ENGINE_TTL.keys()))
