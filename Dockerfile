# Build arguments for version information
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
ARG NODE_ENV=production

# ==== BUILD STAGE ====
FROM node:20.19-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for better-sqlite3 and other native modules
RUN apk add --no-cache python3 make g++ sqlite sqlite-dev

# Copy package files and install dependencies
COPY package*.json ./
# Increase npm timeout and add retry logic for network issues
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci && npm cache clean --force

# Copy source files
COPY . .

# Build TypeScript files and create required directories
# Set dummy JWT_SECRET for build phase (will be overridden at runtime)
RUN JWT_SECRET=build-time-dummy-secret-32chars-minimum NODE_ENV=production npm run build && \
    node scripts/fix-migration-imports.js && \
    mkdir -p public dist/migrations && \
    # Compile server TypeScript files to dist/src/ for module resolution
    npx tsc --project tsconfig.server.json && \
    # Fix ES module imports in compiled lib files
    node scripts/fix-lib-imports.js

# ==== PRODUCTION STAGE ====
FROM node:20.19-alpine AS production

# Import build arguments from root
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF
ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000
ENV HOST=0.0.0.0

# Add version metadata to container
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.title="NCRelay" \
      org.opencontainers.image.description="Securely relay notifications to your favorite platforms" \
      org.opencontainers.image.source="https://github.com/theonlytruebigmac/ncrelay"

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache sqlite tini wget curl

# Copy package files and install only production dependencies
COPY package*.json ./
# Increase npm timeout and add retry logic for network issues
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci --only=production && npm cache clean --force

# Copy built app from builder stage - only what's needed for runtime
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/src /app/src
COPY --from=builder /app/scripts /app/scripts
COPY --from=builder /app/server.js /app/server.js
COPY --from=builder /app/loader.mjs /app/loader.mjs
COPY --from=builder /app/next.config.mjs /app/next.config.mjs
COPY --from=builder /app/tsconfig*.json /app/
COPY docker-start.sh /app/docker-start.sh

# Create necessary directories
RUN mkdir -p /app/public /app/lib /app/migrations /data/backups /data/logs && \
    chown -R node:node /data /app && \
    chmod +x docker-start.sh

# Switch to non-root user
USER node

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Expose the application ports
EXPOSE 3000 9004

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start with our custom script
CMD ["./docker-start.sh"]
