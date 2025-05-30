
'use server';

import * as db from '@/lib/db';

export interface DashboardStats {
  activeIntegrationsCount: number;
  relayedNotificationsCount: number;
  apiEndpointsCount: number;
  apiEndpointsRequestsCount: number;
  // New outbound request metrics
  outboundSuccessCount: number;
  outboundFailureCount: number;
  outboundSuccessRate: number; // Percentage (0-100)
  totalOutboundAttempts: number;
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  return db.getDashboardStats();
}

    