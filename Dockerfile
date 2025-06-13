# Build arguments for version information
ARG VERSION=dev
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown

# Multi-stage build for enhanced security
FROM ubuntu:24.04 AS builder

# Install Node.js from official repository
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install only the necessary build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies with exact versions (production only)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source files
COPY . .

# Build TypeScript files
RUN npm run build

# Production stage - use minimal image
FROM ubuntu:24.04

# Import build arguments from root
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF

# Add version metadata to container
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.title="NCRelay" \
      org.opencontainers.image.description="Securely relay notifications to your favorite platforms" \
      org.opencontainers.image.source="https://github.com/theonlytruebigmac/ncrelay"

# Install Node.js from official repository
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update

WORKDIR /app

# Install system dependencies
RUN apt-get install -y --no-install-recommends \
    nodejs tini sqlite3 wget \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript files and ensure dist directory exists
RUN npm run build && \
    mkdir -p dist/migrations public

# Create necessary directories with proper permissions
RUN mkdir -p /data/backups /data/logs && \
    adduser --disabled-password --gecos "" node && \
    chown -R node:node /data /app && \
    chmod +x docker-start.sh

# Switch to non-root user
USER node

# Use tini as init system
ENTRYPOINT ["/usr/bin/tini", "--"]

# Expose the application port
EXPOSE 3000

# Start with our custom script
CMD ["./docker-start.sh"]
