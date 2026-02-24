# syntax=docker/dockerfile:1

# =============================================================================
# Durabull Production Dockerfile
# Uses turbo prune for optimal monorepo Docker builds
# =============================================================================

FROM oven/bun:1.3.5 AS base
WORKDIR /app

# -----------------------------------------------------------------------------
# Prune: Create minimal monorepo with api + web
# -----------------------------------------------------------------------------
FROM base AS prune
RUN bun add -g turbo
COPY . .
RUN turbo prune @durabull/api @durabull/web @durabull/scripts --docker

# -----------------------------------------------------------------------------
# Deps: Install all dependencies (for building)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY --from=prune /app/out/json/ .
RUN rm -f bun.lock bun.lockb && bun install || true

# -----------------------------------------------------------------------------
# Prod-deps: Production dependencies only (for release)
# -----------------------------------------------------------------------------
FROM base AS prod-deps
COPY --from=prune /app/out/json/ .
RUN rm -f bun.lock bun.lockb && bun install --production || true

# -----------------------------------------------------------------------------
# Build: Build the web app
# -----------------------------------------------------------------------------
FROM deps AS build
COPY --from=prune /app/out/full/ .
# Run vite build directly (skip tsc typecheck - it runs in CI separately)
RUN cd apps/web && bun x vite build

# -----------------------------------------------------------------------------
# Release: Minimal production image
# -----------------------------------------------------------------------------
FROM base AS release

ENV NODE_ENV=production
ENV PORT=3000

# Production deps only (smaller image)
COPY --from=prod-deps /app/node_modules ./node_modules

# Root config files (from prune stage since they're not in out/full)
COPY --from=prune /app/package.json ./
COPY --from=prune /app/tsconfig.json ./

# API and workspace packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
COPY --from=build /app/tooling ./tooling

# Built web app
COPY --from=build /app/apps/web/dist ./apps/web/dist

USER bun
EXPOSE 3000/tcp
ENTRYPOINT ["bun", "run", "apps/api/src/index.ts"]
