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

export async function parseXmlToJson(xml: string): Promise<any> {
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
