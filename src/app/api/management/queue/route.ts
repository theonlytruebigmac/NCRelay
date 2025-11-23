import { NextResponse, type NextRequest } from 'next/server';
import { requirePermission } from '@/lib/permission-middleware';
import {
  getQueueStats,
  getQueuedNotificationsByStatus,
  retryFailedNotification,
  cleanupOldNotifications,
  processQueue,
  getQueuedNotification,
  updateQueuedNotification
} from '@/lib/notification-queue';

export async function GET(request: NextRequest) {
  // Check permission to read logs (tenant admins and system admins)
  const permission = await requirePermission('logs', 'read');
  
  if (!permission.allowed || !permission.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'processing' | 'completed' | 'failed' | null;
    const id = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get a specific notification by ID
    if (id) {
      const notification = await getQueuedNotification(id);
      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }
      return NextResponse.json(notification);
    }

    // Get stats if no specific status is requested
    if (!status) {
      const stats = await getQueueStats();
      return NextResponse.json(stats);
    }

    // Get notifications with the requested status
    const notifications = await getQueuedNotificationsByStatus(status, limit);
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notification queue:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch notification queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Check permission to manage logs (tenant admins and system admins)
  const permission = await requirePermission('logs', 'read');
  
  if (!permission.allowed || !permission.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, id } = await request.json();

    if (!id && (action !== 'process' && action !== 'cleanup')) {
      return NextResponse.json({ error: 'Notification ID is required for this action' }, { status: 400 });
    }

    switch (action) {
      case 'retry':
        // Retry a specific failed notification
        const notification = await retryFailedNotification(id);
        if (!notification) {
          return NextResponse.json({ error: 'Notification not found or not in failed state' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Notification queued for retry', notification });
      
      case 'process':
        // Manually trigger queue processing
        const result = await processQueue();
        return NextResponse.json({
          message: 'Queue processing triggered',
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed
        });
      
      case 'cleanup':
        // Run cleanup of old completed notifications
        const maxAgeDays = parseInt(request.headers.get('X-Cleanup-Age-Days') || '30');
        const deleted = await cleanupOldNotifications(maxAgeDays);
        return NextResponse.json({ message: 'Cleanup completed', deleted });
      
      case 'pause':
        // Pause a specific notification by setting it to "pending" with a future retry time
        const pauseTime = new Date();
        pauseTime.setDate(pauseTime.getDate() + 7); // Pause for 7 days by default
        
        const pausedNotification = await updateQueuedNotification(id, {
          status: 'pending',
          nextRetryAt: pauseTime.toISOString(),
        });
        
        if (!pausedNotification) {
          return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }
        
        return NextResponse.json({
          message: 'Notification paused',
          notification: pausedNotification
        });
      
      case 'delete':
        // Delete a specific notification (soft delete by updating status)
        const existing = await getQueuedNotification(id);
        if (!existing) {
          return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }
        
        // Use SQLite to delete the notification
        const { getDB } = await import('@/lib/db');
        const db = await getDB();
        const stmt = db.prepare('DELETE FROM notification_queue WHERE id = ?');
        stmt.run(id);
        
        return NextResponse.json({
          message: 'Notification deleted',
          id
        });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing notification queue action:', error);
    return NextResponse.json({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
