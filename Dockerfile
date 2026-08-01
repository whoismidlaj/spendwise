# Base image
FROM node:20-alpine AS base

# Install openssl and other prisma dependencies
RUN apk add --no-cache libc6-compat openssl

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build Next.js application
# Next.js telemetry is disabled
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files and prisma schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
COPY docker-entrypoint.sh tsconfig.seed.json ./
RUN chmod +x docker-entrypoint.sh

# Copy built application, public files, and node_modules (with generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use the entrypoint script to run migrations
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Start the application
CMD ["pnpm", "start"]
