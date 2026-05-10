FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for pyarrow / duckdb wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY packages/civicsim_agents /app/packages/civicsim_agents
COPY backend/requirements.txt /app/backend/requirements.txt

RUN pip install -e /app/packages/civicsim_agents \
    && pip install -r /app/backend/requirements.txt

COPY backend /app/backend
COPY data /app/data

WORKDIR /app/backend

ENV BACKEND_HOST=0.0.0.0 \
    BACKEND_PORT=8000 \
    ATP_PRIORS_PATH=/app/data/atp_priors/policy_priors.parquet

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
