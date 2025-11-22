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

# Verify required files exist
if [ ! -f "/app/server.js" ]; then
  echo "ERROR: server.js not found!"
  exit 1
fi

echo "Starting NCRelay application..."

# Wait for SQLite database to be available
while ! test -w /data; do
  echo "Waiting for database volume to be mounted..."
  sleep 1
done

# Run migrations (using compiled JavaScript)
echo "Running database migrations..."
if [ -f dist/migrations/index.js ]; then
  NODE_ENV=production node dist/migrations/index.js || echo "Migration failed, continuing..."
else
  echo "Warning: Migration file not found, skipping..."
fi

# Start the application
echo "Starting NCRelay..."
NODE_ENV=production exec node server.js
