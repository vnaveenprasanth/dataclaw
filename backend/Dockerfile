# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# Use Python 3.12 slim — has pre-built wheels for all our packages
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system dependencies needed to build psycopg2-binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies into a local dir (no venv needed in Docker)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install only the runtime system lib (not the dev headers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Expose Gunicorn port
EXPOSE 5000

# Run Gunicorn
CMD ["gunicorn", \
     "--workers", "2", \
     "--threads", "2", \
     "--worker-class", "gthread", \
     "--bind", "0.0.0.0:5000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "run:app"]
