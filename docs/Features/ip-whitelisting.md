# Custom API Endpoint IP Whitelisting

## Overview

The custom API endpoint IP whitelisting feature allows you to restrict access to your custom endpoints to specific IP addresses. This provides an additional layer of security beyond the randomly generated UUID paths.

## How It Works

When you create or edit a custom API endpoint, you can optionally specify a list of IP addresses that are allowed to access that specific endpoint. If no IP addresses are specified, the endpoint accepts requests from any IP address.

### Features

- **Endpoint-specific restrictions**: Each endpoint can have its own unique IP whitelist
- **IPv4 and IPv6 support**: Supports both IPv4 (e.g., `192.168.1.100`) and IPv6 (e.g., `2001:db8::1`) addresses
- **Localhost handling**: Automatically handles localhost variations (`127.0.0.1`, `::1`, `localhost`)
- **Visual management**: Easy-to-use interface for adding and removing IP addresses
- **Validation**: IP addresses are validated when added to prevent invalid entries

## Configuration

### Adding IP Addresses to Whitelist

1. Navigate to **Dashboard → Settings → API Endpoints**
2. Click **Add Endpoint** or edit an existing endpoint
3. In the **IP Address Whitelist** section:
   - Leave empty to allow all IP addresses (default behavior)
   - Add specific IP addresses to restrict access
   - Use the **+** button or press **Enter** to add an IP address
   - Remove IP addresses by clicking the **×** button on each IP badge

### Supported IP Address Formats

- **IPv4**: `192.168.1.100`, `10.0.0.1`, `127.0.0.1`
- **IPv6**: `2001:db8::1`, `::1`
- **Localhost**: `localhost`, `127.0.0.1`, `::1` (all treated as equivalent)

### Examples

**Example 1: Allow only local access**
```
127.0.0.1
```

**Example 2: Allow specific servers**
```
192.168.1.50
192.168.1.51
10.0.0.100
```

**Example 3: Mixed IPv4 and IPv6**
```
192.168.1.100
2001:db8::1
127.0.0.1
```

## Security Considerations

### When to Use IP Whitelisting

- **High-security environments**: When you need to ensure only specific servers can send notifications
- **Internal networks**: Restrict access to internal IP ranges
- **Known sources**: When you know the exact IP addresses of systems that will send notifications

### Important Notes

- **Dynamic IPs**: Be cautious with dynamic IP addresses that may change over time
- **Load balancers/Proxies**: Consider that requests may come from load balancer or proxy IPs
- **IPv6**: Some networks use IPv6, so include both IPv4 and IPv6 addresses if needed
- **Backup access**: Always test that your notifications work after setting up IP restrictions

## Troubleshooting

### Common Issues

**403 Forbidden Error**
- Check that the sending system's IP address is in the endpoint's whitelist
- Verify the IP address format is correct
- Consider that the client IP might be different due to proxies or load balancers

**Can't access from localhost**
- Add `127.0.0.1`, `::1`, or `localhost` to the whitelist for local testing

### Checking Client IP

The system logs will show the detected client IP address in case of access denial. Check the request logs to see what IP address the system detected for debugging purposes.

### Headers Checked for Client IP

The system checks the following headers to determine the client IP:
1. `X-Forwarded-For` (first IP in the list)
2. `X-Real-IP`
3. `X-Vercel-Proxied-For` (Vercel deployments)
4. `X-Vercel-IP` (Vercel deployments)
5. `CF-Connecting-IP` (Cloudflare)

## API Behavior

When an IP address is not in the whitelist:
- Returns HTTP 403 Forbidden
- Logs the access attempt with the denied IP address
- Does not process the notification further

When the whitelist is empty:
- Allows all IP addresses (default behavior)
- Functions like the original system without IP restrictions
