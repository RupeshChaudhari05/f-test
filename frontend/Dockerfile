# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Build context is ./frontend (set in docker-compose.yaml)
FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_API_URL must be baked at build time so the browser bundle
# knows the backend URL (https://posh-api.fontgenerator.club).
# Force development mode for build — do NOT accept NODE_ENV from build args
ARG NEXT_PUBLIC_API_URL=https://posh-api.fontgenerator.club
ENV NODE_ENV=development
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ARG NODE_ENV=production
ARG NEXT_PUBLIC_API_URL=https://posh-api.fontgenerator.club
ENV NODE_ENV=$NODE_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Standalone output bundles everything needed — no node_modules copy required
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public 2>/dev/null || true

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
