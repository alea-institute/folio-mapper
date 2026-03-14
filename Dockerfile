# Stage 1: Build the frontend
FROM node:20-slim AS frontend-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY packages/web/package.json packages/web/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ packages/
COPY apps/web/ apps/web/

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

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
