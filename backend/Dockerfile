# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace configuration (monorepo)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install dependencies (workspace-aware)
RUN npm ci

# Copy backend source
COPY backend/ ./backend/

# Build from backend directory
WORKDIR /app/backend
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
# sdk-dist is inside backend/ — SDK files served via /sdk route
COPY --from=builder /app/backend/sdk-dist ./sdk-dist

EXPOSE 3000
# sdk-dist is inside backend/ — SDK files served via /sdk route
COPY --from=builder /app/backend/sdk-dist ./sdk-dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
# sdk-dist is inside backend/ — SDK files served via /sdk route
COPY --from=builder /app/backend/sdk-dist ./sdk-dist
# sdk-dist is inside backend/ — SDK files served via /sdk route
COPY --from=builder /app/sdk-dist ./sdk-dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
