import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  retryFailedNotification,
  getQueuedNotification
} from '@/lib/notification-queue';
import { getDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  // Verify admin session
  const user = await getCurrentUser();
  const admin = await isAdmin();
  
  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Notification IDs array is required' }, { status: 400 });
    }

    if (ids.length > 100) {
      return NextResponse.json({ error: 'Cannot perform bulk operation on more than 100 items at once' }, { status: 400 });
    }

    switch (action) {
      case 'retry': {
        // Retry multiple failed notifications
        const results = {
          successful: 0,
          failed: 0,
          errors: [] as string[]
        };

        for (const id of ids) {
          try {
            const notification = await retryFailedNotification(id);
            if (notification) {
              results.successful++;
            } else {
              results.failed++;
              results.errors.push(`${id}: Not found or not in failed state`);
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return NextResponse.json({
          message: `Bulk retry completed: ${results.successful} successful, ${results.failed} failed`,
          results
        });
      }
      
      case 'delete': {
        // Delete multiple notifications
        const db = await getDB();
        const results = {
          successful: 0,
          failed: 0,
          errors: [] as string[]
        };

        for (const id of ids) {
          try {
            const existing = await getQueuedNotification(id);
            if (!existing) {
              results.failed++;
              results.errors.push(`${id}: Not found`);
              continue;
            }

            const stmt = db.prepare('DELETE FROM notification_queue WHERE id = ?');
            stmt.run(id);
            results.successful++;
          } catch (error) {
            results.failed++;
            results.errors.push(`${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return NextResponse.json({
          message: `Bulk delete completed: ${results.successful} successful, ${results.failed} failed`,
          results
        });
      }
      
      case 'cancel': {
        // Cancel (pause indefinitely) multiple notifications
        const db = await getDB();
        const results = {
          successful: 0,
          failed: 0,
          errors: [] as string[]
        };

        const pauseTime = new Date();
        pauseTime.setFullYear(pauseTime.getFullYear() + 10); // Pause for 10 years (effectively cancelled)
        const pauseTimeStr = pauseTime.toISOString();

        for (const id of ids) {
          try {
            const existing = await getQueuedNotification(id);
            if (!existing) {
              results.failed++;
              results.errors.push(`${id}: Not found`);
              continue;
            }

            const stmt = db.prepare(`
              UPDATE notification_queue 
              SET status = 'pending', nextRetryAt = ?, updatedAt = ?
              WHERE id = ?
            `);
            stmt.run(pauseTimeStr, new Date().toISOString(), id);
            results.successful++;
          } catch (error) {
            results.failed++;
            results.errors.push(`${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return NextResponse.json({
          message: `Bulk cancel completed: ${results.successful} successful, ${results.failed} failed`,
          results
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use "retry", "delete", or "cancel"' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing bulk queue action:', error);
    return NextResponse.json({ 
      error: 'Failed to process bulk request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
