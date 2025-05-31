import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromToken } from '@/lib/auth';
import { cleanupOldLogs, getLogStats, createBackup } from '@/lib/log-manager';

// Helper function to verify admin authentication
async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('ncrelay-auth-token')?.value;
  
  if (!token) {
    return null;
  }
  
  const user = await getUserFromToken(token);
  if (!user || !user.isAdmin) {
    return null;
  }
  
  return user;
}

export async function GET() {
  // Verify admin session
  const user = await verifyAdminAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Get log statistics
  const stats = await getLogStats();
  
  return NextResponse.json(stats);
}

export async function POST(req: NextRequest) {
  // Verify admin session
  const user = await verifyAdminAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  try {
    const { action } = await req.json();
    
    if (action === 'cleanup') {
      // Run log cleanup
      const result = await cleanupOldLogs();
      return NextResponse.json(result);
    } 
    else if (action === 'backup') {
      // Create a database backup
      const result = await createBackup();
      return NextResponse.json(result);
    }
    else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing log management request:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
