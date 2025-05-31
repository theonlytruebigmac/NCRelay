# Single stage build for simplicity
FROM node:20-alpine3.19

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache tini sqlite wget

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
    chown -R node:node /data /app && \
    chmod +x docker-start.sh

# Switch to non-root user
USER node

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Expose the application port
EXPOSE 3000

# Start with our custom script
CMD ["./docker-start.sh"]
