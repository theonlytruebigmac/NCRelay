import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseString } from "xml2js";
import { NextRequest } from 'next/server';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getInitials = (name?: string) => {
  if (!name) return "RZ";
  const names = name.split(" ");
  if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
  if (names.length > 1 && names[0] && names[names.length - 1]) {
    return (
      names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase()
    );
  }
  return "RZ";
};

export async function parseXmlToJson(xml: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    parseString(
      xml,
      {
        explicitArray: false,
        mergeAttrs: true,
        explicitRoot: false,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
}

/**
 * Gets the client IP address from a Next.js request
 * Checks x-forwarded-for and x-real-ip headers
 */
export function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For header first
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP in the list (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  // Try X-Real-IP header next
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Try to get from socket address if available
  const remoteAddr = request.headers.get('x-vercel-proxied-for') 
    || request.headers.get('x-vercel-ip')
    || request.headers.get('cf-connecting-ip');
    
  if (remoteAddr) {
    return remoteAddr.trim();
  }

  return 'unknown';
}

/**
 * Gets request context (IP address and User-Agent) for audit logging
 * Returns both values for consistent security event tracking
 */
export function getRequestContext(request: NextRequest): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Checks if an IP address is allowed by the custom endpoint's IP whitelist
 * @param clientIP The client's IP address
 * @param endpointWhitelist Array of IP addresses allowed for the endpoint
 * @returns boolean indicating if the IP is allowed
 */
export function isIPAllowedForEndpoint(clientIP: string, endpointWhitelist: string[]): boolean {
  // If no whitelist is configured, allow all IPs
  if (!endpointWhitelist || endpointWhitelist.length === 0) {
    return true;
  }
  
  // Handle unknown or empty client IP
  if (!clientIP || clientIP === 'unknown') {
    return false;
  }
  
  // Normalize the client IP (trim whitespace)
  const normalizedClientIP = clientIP.trim();
  
  // Check each IP in the whitelist
  for (const whitelistedIP of endpointWhitelist) {
    const normalizedWhitelistedIP = whitelistedIP.trim();
    
    // Direct match
    if (normalizedClientIP === normalizedWhitelistedIP) {
      return true;
    }
    
    // Handle IPv6 localhost variations
    if (normalizedClientIP === '::1' && (normalizedWhitelistedIP === '127.0.0.1' || normalizedWhitelistedIP === 'localhost')) {
      return true;
    }
    if (normalizedClientIP === '127.0.0.1' && normalizedWhitelistedIP === '::1') {
      return true;
    }
    
    // Handle localhost variations
    if (normalizedClientIP === '127.0.0.1' && normalizedWhitelistedIP === 'localhost') {
      return true;
    }
    if (normalizedClientIP === 'localhost' && normalizedWhitelistedIP === '127.0.0.1') {
      return true;
    }
  }
  
  return false;
}
