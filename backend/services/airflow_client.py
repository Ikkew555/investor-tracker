import logging
import os

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_AIRFLOW_URL = os.getenv("AIRFLOW_BASE_URL", "http://airflow-webserver:8080")
_AIRFLOW_USER = os.getenv("AIRFLOW_USER", "admin")
_AIRFLOW_PASSWORD = os.getenv("AIRFLOW_PASSWORD", "admin")
_DEFAULT_DAG_ID = "on_demand_user_calculation_dag"

# The two optimised DAGs that replace the monolithic DAG.
# Both are triggered together by on_transaction_created / /api/refresh.
TAX_DAG_ID    = "tax_user_calc_dag"
MARKET_DAG_ID = "market_user_calc_dag"


def trigger_user_dag(
    user_id: str,
    engines: list[str] | None = None,
    dag_id: str = _DEFAULT_DAG_ID,
) -> str:
    """
    Trigger an Airflow calculation DAG for the given user.

    dag_id:  which DAG to trigger (defaults to the legacy monolithic DAG for
             backwards compatibility; use TAX_DAG_ID / MARKET_DAG_ID for the
             new split DAGs).
    engines: list of engine names, or ["all"] / None for all engines.
    Returns the Airflow dag_run_id string.
    Raises HTTPException 502/503 on Airflow errors.
    """
    if engines is None:
        engines = ["all"]

    url     = f"{_AIRFLOW_URL}/api/v1/dags/{dag_id}/dagRuns"
    payload = {"conf": {"user_id": user_id, "engines": engines}}

    try:
        resp = httpx.post(
            url,
            json=payload,
            auth=(_AIRFLOW_USER, _AIRFLOW_PASSWORD),
            timeout=10,
        )
        resp.raise_for_status()
        dag_run_id = resp.json().get("dag_run_id", "")
        logger.info("Triggered DAG %s for user %s (engines=%s)", dag_id, user_id, engines)
        return dag_run_id
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Airflow trigger failed ({dag_id}): {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Airflow unreachable ({dag_id}): {exc}",
        ) from exc
