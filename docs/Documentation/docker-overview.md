# Docker Containerization Overview

This document explains the Docker setup for the NCRelay application.

## Dockerfile Structure

Our Dockerfile uses a multi-stage build approach to create a lightweight and secure production image:

### Build Stage
- Uses Node.js 20.11 Alpine as the base image
- Installs build dependencies (python3, make, g++, sqlite)
- Builds the Next.js application
- Creates a specialized server module to work in the containerized environment

### Production Stage
- Uses Node.js 20.11 Alpine for minimal footprint
- Copies only the necessary built files from the build stage
- Runs as a non-root user for enhanced security
- Uses tini as an init system for proper process management
- Includes built-in health checks

## Key Features

1. **Security Enhancements**:
   - Non-root user execution
   - Read-only filesystem
   - No new privileges
   - Proper signal handling with tini

2. **Performance Optimizations**:
   - Alpine-based for smaller image size
   - Multi-stage build to reduce final image size
   - Only production dependencies installed in final image

3. **Reliability**:
   - Health check monitoring
   - Proper database migration handling at startup
   - Structured logging

## Docker Volumes

The container uses two persistent volumes:

1. **ncrelay-data**: Stores the SQLite database and related data
2. **ncrelay-logs**: Stores application logs separate from the database

## Port Configuration

The container exposes port 3000 internally, which should be mapped to your desired external port (typically 9004).

## Environment Variables

Configure the container using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `TZ` | Timezone | `UTC` |
| `NEXTAUTH_SECRET` | Authentication secret | Required |
| `PORT` | Internal port (do not change) | `3000` |

## Running with Docker Compose

The recommended way to run NCRelay is with Docker Compose:

```bash
docker-compose up -d
```

This will:
1. Start the container with all required settings
2. Set up persistent volumes
3. Configure networking
4. Apply health checks and restart policies

## Building Locally

To build the image locally:

```bash
docker build -t ncrelay:local .
```

## Troubleshooting

If you encounter issues:

1. **Check container logs**:
   ```bash
   docker logs ncrelay
   ```

2. **Verify database volume**:
   ```bash
   docker volume inspect ncrelay-data
   ```

3. **Check health status**:
   ```bash
   docker inspect --format "{{.State.Health.Status}}" ncrelay
   ```

For more details on deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).
