# Backend Dockerfile for VitalTwin — AI-Powered Clinical Digital Twin
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for compiling C extensions if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and artifacts
COPY . .

# Expose FastAPI default port
# Default port environment variable
ENV PORT=8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT}/health || exit 1

# Start uvicorn server respecting platform $PORT
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
