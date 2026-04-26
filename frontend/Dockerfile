# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Build context is ./frontend (set in docker-compose.yaml)
FROM node:20-alpine AS builder
WORKDIR /app

# NOTE: API URL is NOT baked in at build time.
# next.config.js reads BACKEND_INTERNAL_URL at runtime so the same image
# works for any environment without rebuilding.

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.js ./
EXPOSE 3001
CMD ["npm", "start"]
