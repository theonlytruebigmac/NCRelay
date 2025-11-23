import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getAuditLogs, getAllAuditLogs } from '@/lib/rbac';

export async function GET(request: Request) {
  // Only owners and admins can view audit logs
  const permissionCheck = await requirePermission('logs', 'read');
  
  if (!permissionCheck.allowed) {
    return NextResponse.json(
      { error: 'Forbidden', message: permissionCheck.reason },
      { status: 403 }
    );
  }

  const { tenantId, role, user } = permissionCheck;

  // Only owners and admins can access audit logs
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Only owners and admins can view audit logs' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const resource = searchParams.get('resource') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // System admins can view logs across all tenants if no tenant is selected
    if (!tenantId) {
      if (!user?.isAdmin) {
        return NextResponse.json(
          { error: 'No tenant context available' },
          { status: 400 }
        );
      }
      
      // For system admins in "All Tenants" view, show logs from all tenants
      const logs = await getAllAuditLogs({
        userId,
        resource: resource as any,
        limit,
        offset,
      });
      
      return NextResponse.json({ logs });
    }

    const logs = await getAuditLogs(tenantId, {
      userId,
      resource: resource as any,
      limit,
      offset,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
