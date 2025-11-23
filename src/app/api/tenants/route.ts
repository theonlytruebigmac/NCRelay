import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getAllTenants, 
  getTenantsForUser, 
  createTenant,
  getTenantBySlug 
} from '@/lib/db';
import { z } from 'zod';

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  domain: z.string().optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  maxEndpoints: z.number().int().min(1).optional(),
  maxIntegrations: z.number().int().min(1).optional(),
  maxRequestsPerMonth: z.number().int().min(1).optional(),
});

// GET /api/tenants - List all tenants (admin) or user's tenants
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tenants;
    if (user.isAdmin) {
      // Admins can see all tenants
      tenants = await getAllTenants();
    } else {
      // Regular users see only their tenants
      tenants = await getTenantsForUser(user.id);
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

// POST /api/tenants - Create a new tenant
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can create tenants (for now)
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can create tenants' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateTenantSchema.parse(body);

    // Check if slug already exists
    const existingTenant = await getTenantBySlug(validatedData.slug);
    if (existingTenant) {
      return NextResponse.json(
        { error: 'A tenant with this slug already exists' },
        { status: 400 }
      );
    }

    const tenant = await createTenant(validatedData);

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}
