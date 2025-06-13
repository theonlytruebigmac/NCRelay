#!/bin/sh

# Exit on any error
set -e

# Wait for SQLite database to be available
while ! test -w /data; do
  echo "Waiting for database volume to be mounted..."
  sleep 1
done

# Ensure we're in the correct directory
cd /app

# Run migrations (using compiled JavaScript)
echo "Running database migrations..."
NODE_ENV=production node dist/migrations/index.js

# Start the application
echo "Starting NCRelay..."
NODE_ENV=production exec node server.js
