FROM apache/airflow:2.9.3-python3.11

USER root
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

USER airflow

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy pipeline code into Airflow home so imports resolve
COPY dags/          /opt/airflow/dags/
COPY fetch/         /opt/airflow/fetch/
COPY calculations/  /opt/airflow/calculations/
COPY dbt/           /opt/airflow/dbt/

# COPY runs with Docker daemon privileges and leaves files owned by root.
# Switch back to root to create the dbt target dir and fix ownership, then
# drop back to airflow so the runtime user can write compiled artifacts.
USER root
RUN mkdir -p /opt/airflow/dbt/target \
 && chown -R airflow: /opt/airflow/dbt
USER airflow
