# ====================================
# Build Stage: Frontend
# ====================================
FROM node:18-alpine as frontend-build

WORKDIR /app/frontend

# Install dependencies first (better caching)
COPY frontend/package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./
# Output will be in /app/frontend/dist
RUN npm run build

# ====================================
# Runtime Stage: Backend
# ====================================
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if needed (e.g. git for some tools)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn uvicorn

# Copy backend code
# This copies everything from backend/ into /app/
# Ensure .dockerignore excludes venv/ and __pycache__
COPY backend/ .

# Copy built frontend from stage 1 to the static directory expected by main.py
# main.py looks for `parent.parent / "static"` relative to `app/main.py`
# So we place it in /app/static
COPY --from=frontend-build /app/frontend/dist ./static

# Create a non-root user for security (optional but recommended)
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose the port
EXPOSE 8000

# Run the application
# We run from /app, so module app.main is found in /app/app/main.py
CMD gunicorn -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:$PORT
