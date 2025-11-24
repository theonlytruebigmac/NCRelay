import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import {
  getGlobalWhitelist,
  getGlobalBlacklist,
  addToGlobalWhitelist,
  addToGlobalBlacklist,
  removeFromGlobalWhitelist,
  removeFromGlobalBlacklist,
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

// GET /api/admin/ip-management/global-whitelist
export async function GET(request: NextRequest) {
  try {
    const permission = await requirePermission('settings', 'read');
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const entries = await getGlobalWhitelist();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching global whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global whitelist' },
      { status: 500 }
    );
  }
}

// POST /api/admin/ip-management/global-whitelist
export async function POST(request: NextRequest) {
  try {
    const permission = await requirePermission('settings', 'manage', {
      logAction: true,
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = WhitelistSchema.parse(body);

    await addToGlobalWhitelist(
      validatedData.ipAddress,
      permission.user!.id,
      validatedData.reason
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error adding to global whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to add to global whitelist' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/ip-management/global-whitelist
export async function DELETE(request: NextRequest) {
  try {
    const permission = await requirePermission('settings', 'manage', {
      logAction: true,
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { ipAddress } = body;

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      );
    }

    await removeFromGlobalWhitelist(ipAddress);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from global whitelist:', error);
    return NextResponse.json(
      { error: 'Failed to remove from global whitelist' },
      { status: 500 }
    );
  }
}
