import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { getTenantSecuritySettings, upsertTenantSecuritySettings } from '@/lib/tenant-security';
import { z } from 'zod';

const SecuritySettingsSchema = z.object({
  enforce2FA: z.boolean().optional(),
  require2FAForAdmins: z.boolean().optional(),
  passwordMinLength: z.number().min(6).max(32).optional(),
  passwordRequireUppercase: z.boolean().optional(),
  passwordRequireLowercase: z.boolean().optional(),
  passwordRequireNumbers: z.boolean().optional(),
  passwordRequireSymbols: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().min(5).max(10080).optional(), // 5 min to 1 week
  maxFailedLoginAttempts: z.number().min(3).max(20).optional(),
  lockoutDurationMinutes: z.number().min(5).max(1440).optional(), // 5 min to 24 hours
  rateLimitEnabled: z.boolean().optional(),
  rateLimitMaxRequests: z.number().min(1).max(10000).optional(),
  rateLimitWindowMs: z.number().min(1000).max(3600000).optional(), // 1 second to 1 hour
  rateLimitIpWhitelist: z.array(z.string()).optional(),
});

// GET /api/tenants/[id]/security - Get tenant security settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const permission = await requirePermission('settings', 'read', { 
      tenantId: id 
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const settings = await getTenantSecuritySettings(id);

    if (!settings) {
      // Return default settings if none exist
      return NextResponse.json({
        tenantId: id,
        enforce2FA: false,
        require2FAForAdmins: false,
        passwordMinLength: 8,
        passwordRequireUppercase: false,
        passwordRequireLowercase: false,
        passwordRequireNumbers: false,
        passwordRequireSymbols: false,
        sessionTimeoutMinutes: 480,
        maxFailedLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        rateLimitEnabled: true,
        rateLimitMaxRequests: 100,
        rateLimitWindowMs: 60000,
        rateLimitIpWhitelist: [],
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching tenant security settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security settings' },
      { status: 500 }
    );
  }
}

// PUT /api/tenants/[id]/security - Update tenant security settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const permission = await requirePermission('settings', 'manage', { 
      tenantId: id,
      logAction: true 
    });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = SecuritySettingsSchema.parse(body);

    await upsertTenantSecuritySettings(id, validatedData);

    const updatedSettings = await getTenantSecuritySettings(id);

    return NextResponse.json(updatedSettings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating tenant security settings:', error);
    return NextResponse.json(
      { error: 'Failed to update security settings' },
      { status: 500 }
    );
  }
}
