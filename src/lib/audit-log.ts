import { getDB } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  tenantId: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogWithUser extends AuditLogEntry {
  userName: string | null;
  userEmail: string | null;
  tenantName: string | null;
}

export type AuditAction =
  | 'login_success'
  | 'login_failed'
  | 'login_locked'
  | 'logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | '2fa_enrolled'
  | '2fa_disabled'
  | '2fa_reset'
  | '2fa_enforced'
  | '2fa_unenforced'
  | 'role_changed'
  | 'user_created'
  | 'user_deleted'
  | 'session_created'
  | 'session_revoked'
  | 'account_locked'
  | 'account_unlocked'
  | 'security_settings_updated';

/**
 * Log a security event to the audit log
 */
export async function logSecurityEvent(
  action: AuditAction,
  options: {
    userId?: string;
    tenantId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const db = await getDB();

  db.prepare(`
    INSERT INTO security_audit_log (id, userId, tenantId, action, details, ipAddress, userAgent, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    options.userId || null,
    options.tenantId || null,
    action,
    options.details ? JSON.stringify(options.details) : null,
    options.ipAddress || null,
    options.userAgent || null,
    now
  );
}

/**
 * Get audit log entries with optional filtering
 */
export async function getAuditLogs(options: {
  tenantId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogWithUser[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.tenantId) {
    conditions.push('sal.tenantId = ?');
    params.push(options.tenantId);
  }

  if (options.userId) {
    conditions.push('sal.userId = ?');
    params.push(options.userId);
  }

  if (options.action) {
    conditions.push('sal.action = ?');
    params.push(options.action);
  }

  if (options.startDate) {
    conditions.push('sal.createdAt >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('sal.createdAt <= ?');
    params.push(options.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  params.push(limit, offset);
  const db = await getDB();

  const logs = db.prepare(`
    SELECT 
      sal.*,
      u.name as userName,
      u.email as userEmail,
      t.name as tenantName
    FROM security_audit_log sal
    LEFT JOIN users u ON sal.userId = u.id
    LEFT JOIN tenants t ON sal.tenantId = t.id
    ${whereClause}
    ORDER BY sal.createdAt DESC
    LIMIT ? OFFSET ?
  `).all(...params) as AuditLogWithUser[];

  return logs;
}

/**
 * Get audit log count with optional filtering
 */
export async function getAuditLogCount(options: {
  tenantId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}): Promise<number> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.tenantId) {
    conditions.push('tenantId = ?');
    params.push(options.tenantId);
  }

  if (options.userId) {
    conditions.push('userId = ?');
    params.push(options.userId);
  }

  if (options.action) {
    conditions.push('action = ?');
    params.push(options.action);
  }

  if (options.startDate) {
    conditions.push('createdAt >= ?');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('createdAt <= ?');
    params.push(options.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const db = await getDB();

  const result = db.prepare(
    `SELECT COUNT(*) as count FROM security_audit_log ${whereClause}`
  ).get(...params) as { count: number } | undefined;

  return result?.count || 0;
}

/**
 * Get unique actions from audit log
 */
export async function getAuditActions(tenantId?: string): Promise<string[]> {
  const query = tenantId
    ? `SELECT DISTINCT action FROM security_audit_log WHERE tenantId = ? ORDER BY action`
    : `SELECT DISTINCT action FROM security_audit_log ORDER BY action`;
  const db = await getDB();

  const results = tenantId
    ? db.prepare(query).all(tenantId) as { action: string }[]
    : db.prepare(query).all() as { action: string }[];

  return results.map((r: { action: string }) => r.action);
}

/**
 * Delete old audit log entries
 */
export async function cleanupOldAuditLogs(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const db = await getDB();

  const result = db.prepare(
    `DELETE FROM security_audit_log WHERE createdAt < ?`
  ).run(cutoffDate.toISOString());

  return result.changes || 0;
}
