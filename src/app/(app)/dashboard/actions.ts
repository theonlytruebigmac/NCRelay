
'use server';

import * as db from '@/lib/db';
import { cookies } from 'next/headers';

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

async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  const tenantCookie = cookieStore.get('currentTenantId');
  return tenantCookie?.value || null;
}

export async function getDashboardStatsAction(): Promise<DashboardStats> {
  const tenantId = await getCurrentTenantId();
  return db.getDashboardStats(tenantId || undefined);
}

    