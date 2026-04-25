FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace configuration (monorepo)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Install dependencies (workspace-aware)
RUN npm ci

# Copy frontend source
COPY frontend/ ./frontend/

# Build from frontend directory
WORKDIR /app/frontend
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./
COPY --from=builder /app/frontend/next.config.js ./
EXPOSE 3001
CMD ["npm", "start"]
