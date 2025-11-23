import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getTenantById, 
  updateTenant, 
  deleteTenant,
  getUserRoleInTenant 
} from '@/lib/db';
import { z } from 'zod';

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  domain: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  maxEndpoints: z.number().int().min(1).optional(),
  maxIntegrations: z.number().int().min(1).optional(),
  maxRequestsPerMonth: z.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
  expiresAt: z.string().optional(),
});

// GET /api/tenants/[id] - Get tenant by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenant = await getTenantById(id);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Check if user has access to this tenant
    if (!user.isAdmin) {
      const userRole = await getUserRoleInTenant(id, user.id);
      if (!userRole) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant' },
      { status: 500 }
    );
  }
}

// PATCH /api/tenants/[id] - Update tenant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenant = await getTenantById(id);

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Check permissions - admin or tenant owner/admin
    let canUpdate = user.isAdmin;
    if (!canUpdate) {
      const userRole = await getUserRoleInTenant(id, user.id);
      canUpdate = userRole === 'owner' || userRole === 'admin';
    }

    if (!canUpdate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = UpdateTenantSchema.parse(body);

    const success = await updateTenant(id, validatedData);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update tenant' },
        { status: 500 }
      );
    }

    const updatedTenant = await getTenantById(id);
    return NextResponse.json({ tenant: updatedTenant });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { error: 'Failed to update tenant' },
      { status: 500 }
    );
  }
}

// DELETE /api/tenants/[id] - Delete tenant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Only admins or tenant owners can delete
    let canDelete = user.isAdmin;
    if (!canDelete) {
      const userRole = await getUserRoleInTenant(id, user.id);
      canDelete = userRole === 'owner';
    }

    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const success = await deleteTenant(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete tenant' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { error: 'Failed to delete tenant' },
      { status: 500 }
    );
  }
}
