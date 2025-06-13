import { NextRequest, NextResponse } from 'next/server';

// Rate limiting data store (in-memory for simplicity)
// In a production environment with multiple instances, you'd use Redis or similar
const ipRequestCounts = new Map<string, { count: number, resetTime: number }>();

// Types for security settings
interface SecuritySettings {
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  maxPayloadSize: number;
  apiRateLimitEnabled: boolean;
  ipWhitelist: string[];
}

// Helper to get security settings from environment variables (Edge Runtime compatible)
function getSecuritySettings(): SecuritySettings {
  // Edge Runtime compatible - use only environment variables
  const ipWhitelistEnv = process.env.IP_WHITELIST;
  let ipWhitelist: string[] = [];
  
  if (ipWhitelistEnv) {
    try {
      ipWhitelist = JSON.parse(ipWhitelistEnv);
    } catch (err) {
      console.error('Error parsing IP_WHITELIST env var:', err);
      ipWhitelist = ipWhitelistEnv.split(',').map(ip => ip.trim());
    }
  }
  
  return {
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxPayloadSize: parseInt(process.env.MAX_PAYLOAD_SIZE || '10485760'),
    apiRateLimitEnabled: process.env.API_RATE_LIMIT_ENABLED !== 'false',
    ipWhitelist
  };
}

export async function middleware(request: NextRequest) {
  // Handle filter routes
  if (request.nextUrl.pathname.startsWith('/dashboard/filters/')) {
    // Extract the path segment
    const pathSegments = request.nextUrl.pathname.split('/');
    const id = pathSegments[pathSegments.length - 1];

    // Special case: handle /add and redirect to /create
    if (id === 'add') {
      const url = request.nextUrl.clone();
      pathSegments[pathSegments.length - 1] = 'create';
      url.pathname = pathSegments.join('/');
      return NextResponse.redirect(url);
    }

    // Only validate UUID format for detail/edit pages, excluding special paths
    if (id !== 'create' && !pathSegments.includes('create') && !pathSegments.includes('edit')) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return NextResponse.redirect(new URL('/dashboard/filters', request.url));
      }
    }

    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith('/api')) {
    // Handle API routes rate limiting
    
    // Skip authentication routes to avoid circular dependencies
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  
  // Load security settings
  const settings = getSecuritySettings();
  
  // Skip if rate limiting is disabled
  if (!settings.apiRateLimitEnabled) {
    return NextResponse.next();
  }
  
  // Get client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip'); 
  const ip = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';
  
  // Check if IP is in whitelist
  if (settings.ipWhitelist.includes(ip)) {
    return NextResponse.next();
  }
  
  // Check if the request is authenticated (basic check for auth cookie)
  const authToken = request.cookies.get('ncrelay-auth-token')?.value;
  const isAuthenticated = !!authToken; // Simple check - just verify cookie exists
  
  // Allow all authenticated requests (optional - you can still rate limit authenticated users)
  if (isAuthenticated) {
    return NextResponse.next();
  }
  
  // Apply rate limiting for unauthenticated requests
  const now = Date.now();
  const resetTime = now + settings.rateLimitWindowMs;
  
  // Get current request count for this IP
  const currentData = ipRequestCounts.get(ip);
  
  if (!currentData || now > currentData.resetTime) {
    // First request in a new window
    ipRequestCounts.set(ip, { count: 1, resetTime });
  } else {
    // Increment count for existing window
    currentData.count++;
    
    // Check if over limit
    if (currentData.count > settings.rateLimitMaxRequests) {
      // Add rate limiting headers
      const response = NextResponse.json(
        { error: 'Too many requests', message: 'Rate limit exceeded' },
        { status: 429 }
      );
      
      response.headers.set('X-RateLimit-Limit', settings.rateLimitMaxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', Math.floor(currentData.resetTime / 1000).toString());
      response.headers.set('Retry-After', Math.ceil((currentData.resetTime - now) / 1000).toString());
      
      return response;
    }
  }
  
  // Continue with the request
  const response = NextResponse.next();
  
  // Add rate limiting headers
  const currentCount = ipRequestCounts.get(ip)?.count || 1;
  response.headers.set('X-RateLimit-Limit', settings.rateLimitMaxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', Math.max(0, settings.rateLimitMaxRequests - currentCount).toString());
  response.headers.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
  
    return response;
  } // End of /api handling

  return NextResponse.next();
}

export const config = {
  // Apply middleware to API routes and filter routes
  matcher: [
    // API routes (except auth)
    '/api/((?!auth).*)',
    // Filter routes
    '/dashboard/filters/:path*'
  ]
};