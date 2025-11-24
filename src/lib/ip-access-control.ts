import { getDB } from './db';
import { v4 as uuidv4 } from 'uuid';

export interface IPWhitelistEntry {
  id: string;
  ipAddress: string;
  reason?: string;
  addedBy: string;
  createdAt: string;
  tenantId?: string; // Only for tenant-level entries
}

export interface IPBlacklistEntry {
  id: string;
  ipAddress: string;
  reason: string;
  isPermanent: boolean;
  expiresAt?: string;
  addedBy?: string;
  createdAt: string;
  tenantId?: string; // Only for tenant-level entries
}

export interface IPAccessResult {
  allowed: boolean;
  reason?: string;
  source?: 'global_whitelist' | 'global_blacklist' | 'tenant_whitelist' | 'tenant_blacklist';
}

/**
 * Check if an IP address has access (checks both global and tenant lists)
 * Priority: Global Whitelist > Global Blacklist > Tenant Whitelist > Tenant Blacklist > Allow
 */
export async function checkIPAccess(ipAddress: string, tenantId?: string): Promise<IPAccessResult> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // 1. Check global whitelist (highest priority - always allow)
  const globalWhitelist = db.prepare(`
    SELECT * FROM global_ip_whitelist WHERE ipAddress = ?
  `).get(ipAddress);
  
  if (globalWhitelist) {
    return {
      allowed: true,
      reason: 'IP is on global whitelist',
      source: 'global_whitelist'
    };
  }
  
  // 2. Check global blacklist (blocks everywhere)
  const globalBlacklist = db.prepare(`
    SELECT * FROM global_ip_blacklist 
    WHERE ipAddress = ? 
    AND (isPermanent = 1 OR expiresAt IS NULL OR expiresAt > ?)
  `).get(ipAddress, now) as any;
  
  if (globalBlacklist) {
    return {
      allowed: false,
      reason: globalBlacklist.reason || 'IP is globally blacklisted',
      source: 'global_blacklist'
    };
  }
  
  // 3. If tenant context, check tenant whitelist
  if (tenantId) {
    const tenantWhitelist = db.prepare(`
      SELECT * FROM tenant_ip_whitelist 
      WHERE tenantId = ? AND ipAddress = ?
    `).get(tenantId, ipAddress);
    
    if (tenantWhitelist) {
      return {
        allowed: true,
        reason: 'IP is on tenant whitelist',
        source: 'tenant_whitelist'
      };
    }
    
    // 4. Check tenant blacklist
    const tenantBlacklist = db.prepare(`
      SELECT * FROM tenant_ip_blacklist 
      WHERE tenantId = ? AND ipAddress = ?
      AND (isPermanent = 1 OR expiresAt IS NULL OR expiresAt > ?)
    `).get(tenantId, ipAddress, now) as any;
    
    if (tenantBlacklist) {
      return {
        allowed: false,
        reason: tenantBlacklist.reason || 'IP is blacklisted by tenant',
        source: 'tenant_blacklist'
      };
    }
  }
  
  // Default: allow access
  return { allowed: true };
}

/**
 * Add IP to global whitelist
 */
export async function addToGlobalWhitelist(ipAddress: string, addedBy: string, reason?: string): Promise<void> {
  const db = await getDB();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO global_ip_whitelist (id, ipAddress, reason, addedBy, createdAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(ipAddress) DO UPDATE SET
      reason = excluded.reason,
      addedBy = excluded.addedBy,
      createdAt = excluded.createdAt
  `).run(id, ipAddress, reason || null, addedBy, createdAt);
}

/**
 * Add IP to global blacklist
 */
export async function addToGlobalBlacklist(
  ipAddress: string,
  reason: string,
  isPermanent: boolean = false,
  expiresAt?: string,
  addedBy?: string
): Promise<void> {
  const db = await getDB();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO global_ip_blacklist (id, ipAddress, reason, isPermanent, expiresAt, addedBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ipAddress) DO UPDATE SET
      reason = excluded.reason,
      isPermanent = excluded.isPermanent,
      expiresAt = excluded.expiresAt,
      addedBy = excluded.addedBy,
      createdAt = excluded.createdAt
  `).run(id, ipAddress, reason, isPermanent ? 1 : 0, expiresAt || null, addedBy || null, createdAt);
}

/**
 * Add IP to tenant whitelist
 */
export async function addToTenantWhitelist(
  tenantId: string,
  ipAddress: string,
  addedBy: string,
  reason?: string
): Promise<void> {
  const db = await getDB();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO tenant_ip_whitelist (id, tenantId, ipAddress, reason, addedBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenantId, ipAddress) DO UPDATE SET
      reason = excluded.reason,
      addedBy = excluded.addedBy,
      createdAt = excluded.createdAt
  `).run(id, tenantId, ipAddress, reason || null, addedBy, createdAt);
}

/**
 * Add IP to tenant blacklist
 */
export async function addToTenantBlacklist(
  tenantId: string,
  ipAddress: string,
  reason: string,
  isPermanent: boolean = false,
  expiresAt?: string,
  addedBy?: string
): Promise<void> {
  const db = await getDB();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO tenant_ip_blacklist (id, tenantId, ipAddress, reason, isPermanent, expiresAt, addedBy, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenantId, ipAddress) DO UPDATE SET
      reason = excluded.reason,
      isPermanent = excluded.isPermanent,
      expiresAt = excluded.expiresAt,
      addedBy = excluded.addedBy,
      createdAt = excluded.createdAt
  `).run(id, tenantId, ipAddress, reason, isPermanent ? 1 : 0, expiresAt || null, addedBy || null, createdAt);
}

/**
 * Remove IP from global whitelist
 */
export async function removeFromGlobalWhitelist(ipAddress: string): Promise<void> {
  const db = await getDB();
  db.prepare(`DELETE FROM global_ip_whitelist WHERE ipAddress = ?`).run(ipAddress);
}

/**
 * Remove IP from global blacklist
 */
export async function removeFromGlobalBlacklist(ipAddress: string): Promise<void> {
  const db = await getDB();
  db.prepare(`DELETE FROM global_ip_blacklist WHERE ipAddress = ?`).run(ipAddress);
}

/**
 * Remove IP from tenant whitelist
 */
export async function removeFromTenantWhitelist(tenantId: string, ipAddress: string): Promise<void> {
  const db = await getDB();
  db.prepare(`DELETE FROM tenant_ip_whitelist WHERE tenantId = ? AND ipAddress = ?`).run(tenantId, ipAddress);
}

/**
 * Remove IP from tenant blacklist
 */
export async function removeFromTenantBlacklist(tenantId: string, ipAddress: string): Promise<void> {
  const db = await getDB();
  db.prepare(`DELETE FROM tenant_ip_blacklist WHERE tenantId = ? AND ipAddress = ?`).run(tenantId, ipAddress);
}

/**
 * Get all global whitelist entries
 */
export async function getGlobalWhitelist(): Promise<IPWhitelistEntry[]> {
  const db = await getDB();
  const entries = db.prepare(`
    SELECT * FROM global_ip_whitelist ORDER BY createdAt DESC
  `).all() as any[];
  
  return entries.map(e => ({
    id: e.id,
    ipAddress: e.ipAddress,
    reason: e.reason,
    addedBy: e.addedBy,
    createdAt: e.createdAt
  }));
}

/**
 * Get all global blacklist entries (including expired ones)
 */
export async function getGlobalBlacklist(includeExpired: boolean = false): Promise<IPBlacklistEntry[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  let query = `SELECT * FROM global_ip_blacklist`;
  if (!includeExpired) {
    query += ` WHERE isPermanent = 1 OR expiresAt IS NULL OR expiresAt > ?`;
  }
  query += ` ORDER BY createdAt DESC`;
  
  const stmt = db.prepare(query);
  const entries = (includeExpired ? stmt.all() : stmt.all(now)) as any[];
  
  return entries.map(e => ({
    id: e.id,
    ipAddress: e.ipAddress,
    reason: e.reason,
    isPermanent: !!e.isPermanent,
    expiresAt: e.expiresAt,
    addedBy: e.addedBy,
    createdAt: e.createdAt
  }));
}

/**
 * Get tenant whitelist entries
 */
export async function getTenantWhitelist(tenantId: string): Promise<IPWhitelistEntry[]> {
  const db = await getDB();
  const entries = db.prepare(`
    SELECT * FROM tenant_ip_whitelist WHERE tenantId = ? ORDER BY createdAt DESC
  `).all(tenantId) as any[];
  
  return entries.map(e => ({
    id: e.id,
    ipAddress: e.ipAddress,
    reason: e.reason,
    addedBy: e.addedBy,
    createdAt: e.createdAt,
    tenantId: e.tenantId
  }));
}

/**
 * Get tenant blacklist entries
 */
export async function getTenantBlacklist(tenantId: string, includeExpired: boolean = false): Promise<IPBlacklistEntry[]> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  let query = `SELECT * FROM tenant_ip_blacklist WHERE tenantId = ?`;
  if (!includeExpired) {
    query += ` AND (isPermanent = 1 OR expiresAt IS NULL OR expiresAt > ?)`;
  }
  query += ` ORDER BY createdAt DESC`;
  
  const stmt = db.prepare(query);
  const entries = (includeExpired ? stmt.all(tenantId) : stmt.all(tenantId, now)) as any[];
  
  return entries.map(e => ({
    id: e.id,
    ipAddress: e.ipAddress,
    reason: e.reason,
    isPermanent: !!e.isPermanent,
    expiresAt: e.expiresAt,
    addedBy: e.addedBy,
    createdAt: e.createdAt,
    tenantId: e.tenantId
  }));
}

/**
 * Clean up expired blacklist entries (both global and tenant)
 */
export async function cleanupExpiredBlacklists(): Promise<{ global: number; tenant: number }> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  const globalResult = db.prepare(`
    DELETE FROM global_ip_blacklist 
    WHERE isPermanent = 0 AND expiresAt IS NOT NULL AND expiresAt <= ?
  `).run(now);
  
  const tenantResult = db.prepare(`
    DELETE FROM tenant_ip_blacklist 
    WHERE isPermanent = 0 AND expiresAt IS NOT NULL AND expiresAt <= ?
  `).run(now);
  
  return {
    global: globalResult.changes,
    tenant: tenantResult.changes
  };
}

/**
 * Auto-blacklist an IP after failed login attempts (temporary)
 * Default: 1 hour blacklist
 */
export async function autoBlacklistIP(
  ipAddress: string,
  reason: string,
  tenantId?: string,
  durationMinutes: number = 60
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  
  if (tenantId) {
    await addToTenantBlacklist(tenantId, ipAddress, reason, false, expiresAt);
  } else {
    await addToGlobalBlacklist(ipAddress, reason, false, expiresAt);
  }
}
