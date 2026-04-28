# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Build context is ./backend (set in docker-compose.yaml)
FROM node:20-alpine AS builder
WORKDIR /app

# Force development mode for build — do NOT accept NODE_ENV from build args
ENV NODE_ENV=development

COPY package.json ./
RUN npm install --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# sdk-dist contains pre-built SDK files served via /sdk route
COPY --from=builder /app/sdk-dist ./sdk-dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]
