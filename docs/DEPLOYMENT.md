# Deployment Guide

This guide covers deploying NCRelay in production environments with all security features enabled.

## Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- SQLite database support
- Network access for incoming webhook notifications

## Deployment Steps

### 1. Environment Setup

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd ncrelay
npm install
```

### 2. Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="file:./app.db"

# Authentication
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secure-random-secret"

# Email Configuration (optional)
EMAIL_FROM="noreply@your-domain.com"
SMTP_HOST="your-smtp-server"
SMTP_PORT=587
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"

# Application
NODE_ENV="production"
```

### 3. Database Setup

Run database migrations:

```bash
npm run migrate
```

This will create the SQLite database with all required tables, including:
- User authentication tables
- API endpoints configuration
- Field filters
- IP whitelist settings

### 4. Build and Start

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The application will be available on port 9003 by default.

## Security Configuration

### IP Whitelisting

NCRelay includes endpoint-specific IP whitelisting for custom API endpoints:

1. **Access the Dashboard**: Navigate to Settings > API Endpoints
2. **Configure IP Restrictions**: For each custom endpoint, add allowed IP addresses
3. **IP Format Support**: 
   - IPv4: `192.168.1.100`
   - IPv6: `2001:db8::1`
   - Localhost variations: `127.0.0.1`, `::1`, `localhost`
4. **Empty Whitelist**: When no IPs are specified, all IPs are allowed (backward compatible)

### Authentication

- Built-in user authentication system
- Session management with secure cookies
- Password reset functionality via email

### Field Filters

- Control which XML fields are processed from N-central notifications
- Prevent sensitive data from being forwarded to external services
- Reusable filter configurations

## Production Considerations

### Reverse Proxy Configuration

For production deployments, use a reverse proxy like nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:9003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Important**: When using a reverse proxy, ensure the `X-Forwarded-For` header is properly set for IP whitelisting to work correctly.

### SSL/TLS

Always use HTTPS in production:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # ... rest of configuration
}
```

### Firewall Configuration

Configure your firewall to:
- Allow incoming HTTPS (443) and HTTP (80) traffic
- Restrict direct access to the application port (9003)
- Allow N-central server IPs to reach your webhook endpoints

### Database Backup

Regular backup of the SQLite database:

```bash
# Backup
cp app.db app.db.backup.$(date +%Y%m%d)

# Restore (if needed)
cp app.db.backup.YYYYMMDD app.db
```

### Monitoring

Monitor the following:
- Application logs for errors
- Database size and performance
- Network connectivity to N-central
- Failed authentication attempts
- IP whitelist violations (403 responses)

## Docker Deployment

A Dockerfile is included for containerized deployments:

```bash
# Pull the image from GitHub Container Registry
docker pull ghcr.io/theonlytruebigmac/ncrelay:latest  # Latest stable release
# or use a specific version:
docker pull ghcr.io/theonlytruebigmac/ncrelay:1.2.3   # Specific version

# Run container
docker run -d \
  --name ncrelay \
  -p 9004:3000 \
  -v ncrelay-data:/data \
  -v ncrelay-logs:/data/logs \
  -e NEXTAUTH_SECRET="your-secret" \
  --env-file .env.production \
  ghcr.io/theonlytruebigmac/ncrelay:1.2.3
```

You can also use docker-compose:

```yaml
# docker-compose.yml
version: '3'
services:
  ncrelay:
    image: ghcr.io/theonlytruebigmac/ncrelay:1.2.3
    ports:
      - "9004:3000"
    volumes:
      - ncrelay-data:/data
      - ncrelay-logs:/data/logs
    env_file:
      - .env.production
    environment:
      - NEXTAUTH_SECRET=your-secret
      - NODE_ENV=production
      - TZ=UTC
```

See the [VERSIONING.md](./VERSIONING.md) document for details on our Docker image tagging strategy.

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | SQLite database path | No | `file:./app.db` |
| `NEXTAUTH_URL` | Application base URL | Yes | - |
| `NEXTAUTH_SECRET` | Authentication secret | Yes | - |
| `EMAIL_FROM` | Sender email address | No | - |
| `SMTP_HOST` | SMTP server hostname | No | - |
| `SMTP_PORT` | SMTP server port | No | `587` |
| `SMTP_USER` | SMTP username | No | - |
| `SMTP_PASS` | SMTP password | No | - |
| `NODE_ENV` | Environment mode | No | `development` |

## Troubleshooting

### IP Whitelisting Issues

- **403 Forbidden**: Check if client IP is in the endpoint's whitelist
- **Reverse Proxy**: Ensure `X-Forwarded-For` header is properly configured
- **Localhost Testing**: Use `127.0.0.1` instead of `localhost` for consistency

### Database Issues

- **Migration Errors**: Ensure database file is writable
- **Corruption**: Restore from backup and replay recent changes

### Network Issues

- **N-central Connectivity**: Verify firewall rules and network routing
- **SSL Certificate**: Ensure certificates are valid and properly configured

For additional support, check the [development documentation](./docs/DEVELOPMENT.md) and [implementation summary](./docs/implementation-summary.md).
