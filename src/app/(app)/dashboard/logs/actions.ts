'use server';

import * as db from '@/lib/db';
import type { LogEntry } from '@/lib/types';

export async function getRequestLogsAction(): Promise<LogEntry[]> {
  return db.getRequestLogs();
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
