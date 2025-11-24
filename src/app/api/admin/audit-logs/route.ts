import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getAuditLogs, getAuditLogCount, getAuditActions } from '@/lib/audit-log';

export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission('settings', 'read', {
      logAction: true,
    });

    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const getActions = searchParams.get('getActions') === 'true';

    // If requesting action list
    if (getActions) {
      const actions = await getAuditActions(
        permission.user?.isAdmin ? undefined : permission.tenantId || undefined
      );
      return NextResponse.json({ actions });
    }

    const offset = (page - 1) * pageSize;

    const filters: any = {
      limit: pageSize,
      offset,
    };

    // System admin sees all, tenant admin sees only their tenant
    if (!permission.user?.isAdmin) {
      filters.tenantId = permission.tenantId;
    }

    if (action) filters.action = action;
    if (userId) filters.userId = userId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const [logs, total] = await Promise.all([
      getAuditLogs(filters),
      getAuditLogCount(filters),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
