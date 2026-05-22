# Stage 1: Build the frontend
# Node 22 (>= 22.13) is required by pnpm 10+/11 (pnpm 11 imports node:sqlite, absent in Node 20).
FROM node:22-slim AS frontend-builder

# Pin pnpm to the version that produced pnpm-lock.yaml (lockfileVersion 9.0) so
# `--frozen-lockfile` stays deterministic and never silently jumps to a pnpm that
# needs a newer Node than this base image (the cause of the April–May build failures).
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY packages/web/package.json packages/web/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/web/ apps/web/
# apps/web/vite.config.ts reads the app version from apps/desktop/package.json
# (version source of truth) to bake in __APP_VERSION__. Copy just that file so the
# frontend build does not need the full desktop app in the image.
COPY apps/desktop/package.json apps/desktop/

RUN pnpm --filter @folio-mapper/web build

# Stage 2: Python backend + frontend static files
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv pip install --system --no-cache .

# Copy backend application code
COPY backend/app/ ./app/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/apps/web/dist ./web-dist

# Set environment variables
ENV FOLIO_MAPPER_WEB_DIR=/app/web-dist
ENV FOLIO_MAPPER_NO_AUTH=true

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/api/health')"

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
