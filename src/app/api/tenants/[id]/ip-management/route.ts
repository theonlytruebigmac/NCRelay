import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import {
  getTenantWhitelist,
  getTenantBlacklist,
  addToTenantWhitelist,
  addToTenantBlacklist,
  removeFromTenantWhitelist,
  removeFromTenantBlacklist,
} from '@/lib/ip-access-control';
import { z } from 'zod';

const WhitelistSchema = z.object({
  ipAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address'),
  reason: z.string().optional(),
});

const BlacklistSchema = z.object({
  ipAddress: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IPv4 address'),
  reason: z.string().min(1, 'Reason is required'),
  isPermanent: z.boolean(),
  durationMinutes: z.number().min(1).optional(),
});

// GET /api/tenants/[id]/ip-management
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    
    const permission = await requirePermission('settings', 'read', {
      tenantId,
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const listType = searchParams.get('type'); // 'whitelist' or 'blacklist'

    if (listType === 'whitelist') {
      const entries = await getTenantWhitelist(tenantId);
      return NextResponse.json({ entries });
    } else if (listType === 'blacklist') {
      const entries = await getTenantBlacklist(tenantId);
      return NextResponse.json({ entries });
    } else {
      // Return both
      const whitelist = await getTenantWhitelist(tenantId);
      const blacklist = await getTenantBlacklist(tenantId);
      return NextResponse.json({ whitelist, blacklist });
    }
  } catch (error) {
    console.error('Error fetching tenant IP lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch IP lists' },
      { status: 500 }
    );
  }
}

// POST /api/tenants/[id]/ip-management
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    
    const permission = await requirePermission('settings', 'manage', {
      tenantId,
      logAction: true,
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { type } = body; // 'whitelist' or 'blacklist'

    if (type === 'whitelist') {
      const validatedData = WhitelistSchema.parse(body);
      await addToTenantWhitelist(
        tenantId,
        validatedData.ipAddress,
        permission.user!.id,
        validatedData.reason
      );
    } else if (type === 'blacklist') {
      const validatedData = BlacklistSchema.parse(body);
      let expiresAt: string | undefined;
      if (!validatedData.isPermanent && validatedData.durationMinutes) {
        expiresAt = new Date(Date.now() + validatedData.durationMinutes * 60 * 1000).toISOString();
      }
      await addToTenantBlacklist(
        tenantId,
        validatedData.ipAddress,
        validatedData.reason,
        validatedData.isPermanent,
        expiresAt,
        permission.user!.id
      );
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error adding to tenant IP list:', error);
    return NextResponse.json(
      { error: 'Failed to add to IP list' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id]/ip-management/[ipAddress]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ipAddress: string }> }
) {
  try {
    const { id: tenantId, ipAddress } = await params;
    
    const permission = await requirePermission('settings', 'manage', {
      tenantId,
      logAction: true,
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'whitelist' or 'blacklist'

    const decodedIP = decodeURIComponent(ipAddress);

    if (type === 'whitelist') {
      await removeFromTenantWhitelist(tenantId, decodedIP);
    } else if (type === 'blacklist') {
      await removeFromTenantBlacklist(tenantId, decodedIP);
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from tenant IP list:', error);
    return NextResponse.json(
      { error: 'Failed to remove from IP list' },
      { status: 500 }
    );
  }
}
