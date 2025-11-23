import { NextResponse } from 'next/server';
import { openApiAdminSpec } from '@/lib/openapi-admin-spec';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  // Require system admin authentication
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  if (!user.isAdmin) {
    return NextResponse.json(
      { error: 'System administrator access required' },
      { status: 403 }
    );
  }

  return NextResponse.json(openApiAdminSpec, {
    headers: {
      'Cache-Control': 'private, max-age=3600', // Private cache for authenticated users
    },
  });
}
