# Docker Setup Review - NCRelay

## ✅ Issues Fixed

### 1. **Missing .dockerignore File**
- Created comprehensive .dockerignore to exclude unnecessary files
- Reduces image size and build time
- Prevents sensitive files from being included

### 2. **Duplicate Commands in docker-start.sh**
- Removed duplicate "Start the application" commands
- Added error handling for migrations
- Improved logging and validation

### 3. **Port Configuration**
- Clarified port mapping: External ${PORT:-9004} → Internal 3000
- Added HOST environment variable
- Ensured proper environment variable propagation

### 4. **Missing tsconfig Files in Production Image**
- Added tsconfig*.json files to production stage
- Required for some runtime type checking

### 5. **Migration Error Handling**
- Added conditional check for migration file existence
- Graceful degradation if migrations fail
- Better error messages

## 📋 Current Docker Configuration

### Build Arguments
- `VERSION`: Version tag (default: "dev")
- `BUILD_DATE`: ISO 8601 timestamp
- `VCS_REF`: Git commit hash
- `NODE_ENV`: Environment (default: "production")

### Ports
- **External**: Configurable via `PORT` env var (default: 9004)
- **Internal**: 3000 (hardcoded in container)

### Volumes
- `ncrelay-data:/data` - Database and persistent data
- `ncrelay-logs:/data/logs` - Application logs

### Security Features
- ✅ Runs as non-root user (node)
- ✅ Read-only filesystem
- ✅ No new privileges
- ✅ tmpfs for temporary files
- ✅ Healthcheck endpoint

## 🔧 Build Process

### Multi-Stage Build
1. **Builder Stage**:
   - Installs all dependencies
   - Compiles TypeScript
   - Builds Next.js app
   - Runs migrations compilation
   - Copies server-docker.js stub

2. **Production Stage**:
   - Only production dependencies
   - Copies built artifacts
   - Sets up runtime environment
   - Configures security

### Build Command
```bash
docker build -t ncrelay:latest .
```

### Build with Arguments
```bash
docker build \
  --build-arg VERSION="1.0.0" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
  -t ncrelay:1.0.0 \
  .
```

## 🚀 Running the Container

### Using Docker Compose (Recommended)
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Docker Run
```bash
docker run -d \
  --name ncrelay \
  -p 9004:3000 \
  -v ncrelay-data:/data \
  -v ncrelay-logs:/data/logs \
  --env-file .env \
  ncrelay:latest
```

## 🧪 Testing the Build

A test script has been created: `test-docker-build.sh`

```bash
# Run the test
./test-docker-build.sh
```

This script will:
1. Check Docker installation
2. Verify .env file exists
3. Clean up previous test builds
4. Build the image
5. Test the built image
6. Provide next steps

## 📝 Environment Variables

### Required
- `JWT_SECRET` - Secret key for JWT tokens (min 32 chars)
- `DATABASE_PATH` - Path to SQLite database (default: /data/app.db)

### Optional
- `PORT` - Internal port (default: 3000)
- `HOST` - Bind host (default: 0.0.0.0)
- `NODE_ENV` - Environment (default: production)
- `RATE_LIMIT_MAX_REQUESTS` - Rate limit (default: 100)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 60000)
- `MAX_PAYLOAD_SIZE` - Max payload size (default: 10485760)
- `IP_WHITELIST` - JSON array of whitelisted IPs

## ⚠️ Known Considerations

### 1. **Database Initialization**
- Database is created on first run
- Migrations run automatically on startup
- Volume must be writable

### 2. **File Permissions**
- Container runs as user 'node' (UID 1000)
- Ensure volumes have correct permissions
- `/data` and `/data/logs` must be writable

### 3. **Network Configuration**
- Container binds to 0.0.0.0:3000 internally
- Use docker-compose network or custom networks
- Healthcheck uses internal port 3000

### 4. **Resource Limits**
Consider adding to docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

## 🔍 Troubleshooting

### Build Fails
1. Check Node.js version (requires 20.11+)
2. Verify all dependencies in package.json
3. Ensure network connectivity for npm
4. Check disk space

### Container Won't Start
1. Check environment variables
2. Verify volume permissions
3. Check logs: `docker logs ncrelay`
4. Ensure port 3000 is available

### Database Issues
1. Verify /data volume is mounted
2. Check write permissions
3. Look for migration errors in logs
4. Manually run migrations if needed

### Performance Issues
1. Set resource limits
2. Check log levels
3. Monitor with: `docker stats ncrelay`
4. Review application logs

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- Project-specific docs in `docs/` folder
