import { getDB } from './db';
import crypto from 'crypto';
import { logSecurityEvent } from './audit-log';

interface UserSession {
  id: string;
  userId: string;
  tenantId: string | null;
  sessionToken: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

interface SessionWithUserInfo extends UserSession {
  userName: string;
  userEmail: string;
}

/**
 * Create a new user session
 */
export async function createSession(
  userId: string,
  tenantId: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  expiresInMinutes: number = 480 // 8 hours default
): Promise<string> {
  const db = await getDB();
  const { v4: uuidv4 } = await import('uuid');
  
  const sessionId = uuidv4();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60 * 1000);
  
  // Parse user agent for device info
  const deviceInfo = parseUserAgent(userAgent);
  
  db.prepare(`
    INSERT INTO user_sessions (
      id, userId, tenantId, sessionToken, ipAddress, 
      userAgent, deviceInfo, lastActivityAt, expiresAt, createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    userId,
    tenantId,
    sessionToken,
    ipAddress,
    userAgent,
    JSON.stringify(deviceInfo),
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString()
  );
  
  // Log session creation
  await logSecurityEvent('session_created', {
    userId,
    tenantId: tenantId || undefined,
    details: { 
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os
    },
    ipAddress: ipAddress || undefined,
    userAgent: userAgent || undefined,
  });
  
  return sessionToken;
}

/**
 * Get all active sessions for a user with user and tenant info
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const db = await getDB();
  
  const sessions = db.prepare(`
    SELECT 
      s.*,
      u.name as userName,
      u.email as userEmail,
      t.name as tenantName
    FROM user_sessions s
    JOIN users u ON s.userId = u.id
    LEFT JOIN tenants t ON s.tenantId = t.id
    WHERE s.userId = ? AND s.expiresAt > datetime('now')
    ORDER BY s.lastActivityAt DESC
  `).all(userId) as any[];
  
  return sessions.map(session => ({
    ...session,
    deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
  }));
}

/**
 * Get all sessions across all users (admin view)
 */
export async function getAllSessions(limit: number = 100): Promise<SessionWithUserInfo[]> {
  const db = await getDB();
  
  const sessions = db.prepare(`
    SELECT 
      s.*,
      u.name as userName,
      u.email as userEmail
    FROM user_sessions s
    JOIN users u ON s.userId = u.id
    WHERE s.expiresAt > datetime('now')
    ORDER BY s.lastActivityAt DESC
    LIMIT ?
  `).all(limit) as any[];
  
  return sessions.map(session => ({
    ...session,
    deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
  }));
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const db = await getDB();
  
  db.prepare(`
    UPDATE user_sessions
    SET lastActivityAt = ?
    WHERE sessionToken = ? AND expiresAt > datetime('now')
  `).run(new Date().toISOString(), sessionToken);
}

/**
 * Revoke a specific session by ID
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = await getDB();
  
  // Get session info before deleting
  const session = db.prepare(`
    SELECT userId, tenantId FROM user_sessions WHERE id = ?
  `).get(sessionId) as { userId: string; tenantId: string | null } | undefined;
  
  db.prepare(`
    DELETE FROM user_sessions
    WHERE id = ?
  `).run(sessionId);
  
  // Log session revocation
  if (session) {
    await logSecurityEvent('session_revoked', {
      userId: session.userId,
      tenantId: session.tenantId || undefined,
      details: { sessionId },
    });
  }
}

/**
 * Revoke a specific session by token
 */
export async function revokeSessionByToken(sessionToken: string): Promise<void> {
  const db = await getDB();
  
  // Get session info before deleting
  const session = db.prepare(`
    SELECT id, userId, tenantId FROM user_sessions WHERE sessionToken = ?
  `).get(sessionToken) as { id: string; userId: string; tenantId: string | null } | undefined;
  
  if (!session) {
    return; // Session doesn't exist, nothing to revoke
  }
  
  db.prepare(`
    DELETE FROM user_sessions
    WHERE sessionToken = ?
  `).run(sessionToken);
  
  // Log session revocation
  await logSecurityEvent('session_revoked', {
    userId: session.userId,
    tenantId: session.tenantId || undefined,
    details: { sessionId: session.id },
  });
}

/**
 * Revoke all sessions for a user except the current one
 */
export async function revokeOtherSessions(userId: string, currentSessionToken: string): Promise<number> {
  const db = await getDB();
  
  const result = db.prepare(`
    DELETE FROM user_sessions
    WHERE userId = ? AND sessionToken != ?
  `).run(userId, currentSessionToken);
  
  return result.changes;
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const db = await getDB();
  
  const result = db.prepare(`
    DELETE FROM user_sessions
    WHERE userId = ?
  `).run(userId);
  
  return result.changes;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = await getDB();
  
  const result = db.prepare(`
    DELETE FROM user_sessions
    WHERE expiresAt <= datetime('now')
  `).run();
  
  return result.changes;
}

/**
 * Get session by token
 */
export async function getSessionByToken(sessionToken: string): Promise<UserSession | null> {
  const db = await getDB();
  
  const session = db.prepare(`
    SELECT * FROM user_sessions
    WHERE sessionToken = ? AND expiresAt > datetime('now')
  `).get(sessionToken) as any;
  
  if (!session) {
    return null;
  }
  
  return {
    ...session,
    deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
  };
}

/**
 * Get approximate location from IP address using ipapi.co
 * Returns city, region, country or null if lookup fails
 */
export async function getLocationFromIP(ipAddress: string | null): Promise<string | null> {
  if (!ipAddress || ipAddress === 'unknown' || ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    return 'Local Network';
  }
  
  try {
    // Use ipapi.co free API (no key required, 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
      headers: { 'User-Agent': 'NCRelay-SessionManager' },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    // Check if API returned an error (e.g., reserved IP)
    if (data.error || data.reserved) {
      return 'Local Network';
    }
    
    // Build location string from available data
    const parts = [];
    if (data.city) parts.push(data.city);
    if (data.region) parts.push(data.region);
    if (data.country_name) parts.push(data.country_name);
    
    return parts.length > 0 ? parts.join(', ') : null;
  } catch (error) {
    // Silently fail - geolocation is nice to have but not critical
    return null;
  }
}

/**
 * Parse user agent string to extract device info
 */
function parseUserAgent(userAgent: string | null): any {
  if (!userAgent) {
    return { browser: 'Unknown', os: 'Unknown', device: 'Unknown', deviceType: 'Desktop' };
  }
  
  const info: any = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Desktop',
    deviceType: 'Desktop',
  };
  
  // Detect browser
  if (userAgent.includes('Chrome')) info.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) info.browser = 'Safari';
  else if (userAgent.includes('Edge')) info.browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident')) info.browser = 'Internet Explorer';
  
  // Detect OS
  if (userAgent.includes('Windows')) info.os = 'Windows';
  else if (userAgent.includes('Mac OS')) info.os = 'macOS';
  else if (userAgent.includes('Linux')) info.os = 'Linux';
  else if (userAgent.includes('Android')) info.os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) info.os = 'iOS';
  
  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    info.device = 'Mobile';
    info.deviceType = 'Mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    info.device = 'Tablet';
    info.deviceType = 'Tablet';
  }
  
  return info;
}

/**
 * Get session count for a user
 */
export async function getUserSessionCount(userId: string): Promise<number> {
  const db = await getDB();
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM user_sessions
    WHERE userId = ? AND expiresAt > datetime('now')
  `).get(userId) as any;
  
  return result?.count || 0;
}
