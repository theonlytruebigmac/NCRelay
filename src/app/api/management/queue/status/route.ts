import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isQueueProcessingEnabled, setQueueProcessingEnabled } from '@/lib/system-settings';

/**
 * API route for queue processing status
 */
export async function GET() {
  try {
    // Check if user is admin
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }
    
    const enabled = await isQueueProcessingEnabled();
    
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error getting queue processing status:', error);
    return NextResponse.json(
      { error: 'Failed to get queue processing status' },
      { status: 500 }
    );
  }
}

/**
 * Set queue processing status
 */
export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    const isUserAdmin = await isAdmin();
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }
    
    // Get enabled state from request body
    const body = await request.json();
    
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Request must include "enabled" boolean property' },
        { status: 400 }
      );
    }
    
    // Update queue processing state
    await setQueueProcessingEnabled(body.enabled);
    
    return NextResponse.json({ 
      success: true, 
      enabled: body.enabled,
      message: body.enabled ? 'Queue processing enabled' : 'Queue processing paused'
    });
  } catch (error) {
    console.error('Error setting queue processing status:', error);
    return NextResponse.json(
      { error: 'Failed to update queue processing status' },
      { status: 500 }
    );
  }
}
