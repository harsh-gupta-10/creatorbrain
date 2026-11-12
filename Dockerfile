# Multi-stage Dockerfile for CreatorBrain (Google Cloud Run / Container deployment)
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build client assets
COPY . .
RUN npm run build
RUN npx tsc --noEmit

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app /app

# Run migrations on local D1 sqlite database
RUN npx wrangler d1 execute DB --local --file=migrations/0001_initial_schema.sql --yes || true
RUN npx wrangler d1 execute DB --local --file=migrations/0002_seed_demo_data.sql --yes || true

EXPOSE 8080

# Launch Cloudflare Worker runtime via Wrangler
CMD ["sh", "-c", "npx wrangler dev --port ${PORT:-8080} --ip 0.0.0.0"]
