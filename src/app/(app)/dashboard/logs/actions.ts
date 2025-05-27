
'use server';

import * as db from '@/lib/db';
import type { LogEntry } from '@/lib/types';

export async function getRequestLogsAction(): Promise<LogEntry[]> {
  return db.getRequestLogs();
}
