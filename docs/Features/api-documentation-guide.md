# API Documentation Implementation

## Overview

NCRelay now includes comprehensive interactive API documentation powered by Swagger UI and OpenAPI 3.0 specification.

## Features

### 🎯 Interactive Documentation
- **Live Testing**: Try API endpoints directly from the browser
- **Request/Response Examples**: See real examples for all endpoints
- **Schema Validation**: Automatic validation of request/response formats
- **Authentication Support**: Test authenticated endpoints with session cookies

### 📚 Comprehensive Coverage
The API documentation includes:
- **Webhook Endpoints** (`/api/custom/{endpointPath}`)
  - Receive and relay notifications
  - XML/JSON payload support
  - Field filtering capabilities
  
- **Queue Management** (`/api/management/queue/*`)
  - View queue statistics
  - Individual notification operations (retry, pause, delete)
  - Bulk operations (up to 100 items)
  - Queue processing control
  
- **Monitoring** (`/api/monitoring/live`)
  - Real-time system metrics
  - Queue statistics
  - Integration health
  - Recent activity feed
  
- **Health & Metrics** (`/api/health`, `/api/metrics`)
  - System health checks
  - Prometheus metrics

### 🎨 Theme Integration
- Matches NCRelay's theme (light/dark mode support)
- Responsive design
- Custom styling for better readability

## Accessing the Documentation

### Via Dashboard
1. Log in to NCRelay
2. Navigate to **Dashboard → API Docs** (in sidebar under "Tenant Settings")
3. Browse the interactive documentation

### Direct URL
- **UI**: `http://your-domain/dashboard/docs/api`
- **OpenAPI Spec (JSON)**: `http://your-domain/api/docs/openapi.json`

## Quick Start Examples

### 1. Send a Webhook Notification

```bash
# Basic XML notification (N-Central format)
curl -X POST http://your-domain/api/custom/{endpoint-uuid} \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<notification>
  <subject>Server Alert</subject>
  <message>CPU usage high on server-01</message>
  <severity>warning</severity>
</notification>'

# JSON notification
curl -X POST http://your-domain/api/custom/{endpoint-uuid} \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Server Alert",
    "message": "CPU usage high on server-01",
    "severity": "warning"
  }'
```

### 2. Get Queue Statistics

```bash
# Get overall queue stats (requires authentication)
curl http://your-domain/api/management/queue \
  -H "Cookie: session={your-session-cookie}"

# Get failed notifications
curl http://your-domain/api/management/queue?status=failed \
  -H "Cookie: session={your-session-cookie}"
```

### 3. Bulk Retry Failed Notifications

```bash
curl -X POST http://your-domain/api/management/queue/bulk \
  -H "Content-Type: application/json" \
  -H "Cookie: session={your-session-cookie}" \
  -d '{
    "action": "retry",
    "ids": ["notification-id-1", "notification-id-2"]
  }'
```

### 4. Monitor System Health

```bash
# Public health check endpoint
curl http://your-domain/api/health

# Prometheus metrics
curl http://your-domain/api/metrics
```

## Using the Interactive UI

### Try It Out Feature
1. Click on any endpoint to expand it
2. Click the **"Try it out"** button
3. Fill in the required parameters
4. Click **"Execute"** to make the actual API call
5. View the response in real-time

### Authentication
For authenticated endpoints (queue management, monitoring):
- Endpoints use session-based authentication
- You must be logged into NCRelay in the same browser
- The session cookie is automatically included in requests

### Filtering & Search
- Use the search box at the top to find specific endpoints
- Filter by tags (Webhooks, Queue Management, Monitoring, etc.)

## OpenAPI Specification

### Download Specification
The OpenAPI 3.0 specification can be:
- **Viewed**: Click "View JSON" button in the UI
- **Downloaded**: `wget http://your-domain/api/docs/openapi.json`
- **Copied**: Click "Copy Spec" button in the UI

### Import to Tools
The OpenAPI spec can be imported into:
- **Postman**: Import → Link → Paste URL
- **Insomnia**: Import/Export → From URL
- **Swagger Editor**: File → Import URL
- **Code Generators**: Use OpenAPI generators to create client SDKs

## Security Considerations

### Webhook Endpoints
- Use UUID-based paths to prevent enumeration
- Configure IP whitelisting for additional security
- All requests are logged for audit purposes

### Management Endpoints
- Require admin authentication
- Session-based with HTTP-only cookies
- CSRF protection enabled
- Rate limiting enforced

### Best Practices
1. **Never expose your endpoint UUIDs publicly**
2. **Use IP whitelisting when possible**
3. **Monitor failed requests in audit logs**
4. **Rotate endpoint paths if compromised**
5. **Review queue activity regularly**

## API Response Codes

### Success Codes
- `200 OK`: Request successful
- `201 Created`: Resource created

### Client Error Codes
- `400 Bad Request`: Invalid request format
- `401 Unauthorized`: Missing authentication
- `403 Forbidden`: Insufficient permissions or IP not whitelisted
- `404 Not Found`: Endpoint doesn't exist

### Server Error Codes
- `500 Internal Server Error`: Server-side error
- `503 Service Unavailable`: System maintenance or overload

## Rate Limiting

### Per-Tenant Limits
- Configurable via tenant settings
- Default limits apply to webhook endpoints
- Management endpoints have separate rate limits
- Limits reset per rolling window

### Headers
Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640000000
```

## Troubleshooting

### Common Issues

**Issue**: "401 Unauthorized" on management endpoints
- **Solution**: Ensure you're logged in and have admin privileges

**Issue**: "403 Forbidden" on webhook endpoint
- **Solution**: Check IP whitelisting configuration for the endpoint

**Issue**: "404 Not Found" on webhook endpoint
- **Solution**: Verify the endpoint UUID is correct

**Issue**: Swagger UI not loading
- **Solution**: Check browser console for errors, clear cache

### Getting Help

- Check the **Live Monitor** dashboard for real-time request logs
- Review **Audit Logs** for security-related issues
- Check **Queue** page for notification delivery issues
- View **Health** endpoint for system status

## Technical Details

### Implementation
- **Specification**: OpenAPI 3.0
- **UI Framework**: Swagger UI React 5.x
- **Generation**: swagger-jsdoc
- **Hosting**: Next.js API routes
- **Styling**: Tailwind CSS with custom theme

### Files
- Specification: `src/lib/openapi-spec.ts`
- API Route: `src/app/api/docs/openapi.json/route.ts`
- UI Page: `src/app/(app)/dashboard/docs/api/page.tsx`
- Styling: `src/app/globals.css` (Swagger UI section)

### Extending Documentation
To add new endpoints to the documentation:

1. Edit `src/lib/openapi-spec.ts`
2. Add endpoint to `paths` object
3. Define schemas in `components.schemas` if needed
4. Restart the development server

Example:
```typescript
'/api/my-endpoint': {
  get: {
    tags: ['My Tag'],
    summary: 'My endpoint summary',
    description: 'Detailed description...',
    responses: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/MySchema' }
          }
        }
      }
    }
  }
}
```

## Future Enhancements

Potential improvements:
- [ ] Auto-generate OpenAPI spec from code annotations
- [ ] Add more webhook examples (different notification types)
- [ ] Include integration-specific payload transformations
- [ ] Add code generation for client SDKs
- [ ] Webhook testing tool within the UI
- [ ] API versioning support

## Changelog

### Version 1.0.0 (Initial Release)
- Complete OpenAPI 3.0 specification
- Interactive Swagger UI implementation
- Coverage of all public and management endpoints
- Theme integration with NCRelay design
- Quick start guide and examples
- Security documentation

---

**Note**: This API documentation is automatically kept in sync with the actual API implementation. If you notice any discrepancies, please report them to the development team.
