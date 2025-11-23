'use server';

import * as db from '@/lib/db';
import type { LogEntry } from '@/lib/types';
import { cookies } from 'next/headers';

async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('currentTenantId');
  return tenantCookie?.value || null;
}

export async function getRequestLogsAction(): Promise<LogEntry[]> {
  const tenantId = await getCurrentTenantId();
  return tenantId ? db.getRequestLogs(tenantId) : db.getRequestLogs();
}

export async function getLogByIdAction(logId: string): Promise<LogEntry | null> {
  return db.getRequestLogById(logId);
}

export async function deleteLogEntryAction(logId: string): Promise<void> {
  return db.deleteRequestLog(logId);
}

export async function deleteAllLogEntriesAction(): Promise<void> {
  return db.deleteAllRequestLogs();
}
