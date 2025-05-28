
'use server';

import * as db from '@/lib/db';

export interface DashboardStats {
  activeIntegrationsCount: number;
  relayedNotificationsCount: number;
  apiEndpointsCount: number;
  apiEndpointsRequestsCount: number;
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  return db.getDashboardStats();
}

    