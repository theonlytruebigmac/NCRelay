import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import { 
  getTenantSmtpSettings, 
  upsertTenantSmtpSettings, 
  deleteTenantSmtpSettings,
  testSmtpSettings 
} from '@/lib/smtp-settings';
import { z } from 'zod';

const SmtpSettingsSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  fromAddress: z.string().email('Invalid email address'),
  fromName: z.string().optional(),
  useTLS: z.boolean().optional(),
});

const TestSmtpSchema = z.object({
  testEmail: z.string().email('Invalid test email address'),
  settings: SmtpSettingsSchema,
});

// GET /api/tenants/[id]/smtp - Get SMTP settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const permission = await requirePermission('settings', 'read', { tenantId: id });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const settings = await getTenantSmtpSettings(id);

    if (!settings) {
      return NextResponse.json({ configured: false });
    }

    // Don't send encrypted password to client
    const { encryptedPassword, ...safeSettings } = settings;

    return NextResponse.json({ 
      configured: true,
      settings: {
        ...safeSettings,
        hasPassword: true // Indicate that password is set
      }
    });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMTP settings' },
      { status: 500 }
    );
  }
}

// PUT /api/tenants/[id]/smtp - Update SMTP settings
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
    const validatedData = SmtpSettingsSchema.parse(body);

    await upsertTenantSmtpSettings(id, validatedData);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to update SMTP settings' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id]/smtp - Delete SMTP settings
export async function DELETE(
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

    await deleteTenantSmtpSettings(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to delete SMTP settings' },
      { status: 500 }
    );
  }
}

// POST /api/tenants/[id]/smtp/test - Test SMTP settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const permission = await requirePermission('settings', 'manage', { tenantId: id });
    
    if (!permission.allowed) {
      return NextResponse.json({ error: permission.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { testEmail, settings } = TestSmtpSchema.parse(body);

    const result = await testSmtpSettings(settings, testEmail);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Test email sent successfully' });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error testing SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to test SMTP settings' },
      { status: 500 }
    );
  }
}
