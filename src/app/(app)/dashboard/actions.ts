
'use server';

import * as db from '@/lib/db';

export interface DashboardStats {
  activeIntegrationsCount: number;
  relayedNotificationsCount: number;
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  return db.getDashboardStats();
}

    