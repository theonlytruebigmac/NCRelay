# Notification Preferences Guide

This guide explains how to use and configure the notification preferences system in NCRelay.

## Overview

The notification preferences system allows users to control how and when they receive notifications about relay events. Users can configure:

- **Email Notifications**: Receive notifications via email
- **System Notifications**: Receive in-browser notifications (future feature)
- **Important Only**: Only receive notifications marked as important
- **Failure Notifications Only**: Only receive notifications about failed relay attempts
- **Email Digest Frequency**: Receive periodic summary emails (daily, weekly, monthly, or never)

## User Interface

Users can manage their notification preferences by navigating to:

**Dashboard → Settings → Notification Preferences**

Or directly at: `/dashboard/settings/notifications`

The UI provides toggle switches for each preference and a dropdown for digest frequency.

## Features

### 1. Email Notifications for Failures

When a notification delivery fails after all retry attempts, users with email notifications enabled will receive an email containing:

- Integration name and platform
- API endpoint details
- Error information
- Retry attempt count
- Link to dashboard for more details

### 2. Email Digests

Users can opt to receive periodic digest emails summarizing their notification activity:

- **Daily**: Sent at 8 AM every day
- **Weekly**: Sent at 8 AM every Monday
- **Monthly**: Sent at 8 AM on the 1st of each month

Digests include:
- Total notifications in the period
- Success vs failure counts
- Top 5 integrations by notification volume
- Link to dashboard

### 3. Flexible Filtering

Users can filter which notifications they receive:

- **Failure Notifications Only**: Only get notified about delivery failures
- **Important Only**: Only get notified about high-priority events

## Technical Implementation

### Database Schema

The `notification_preferences` table stores user preferences:

```sql
CREATE TABLE notification_preferences (
  userId TEXT PRIMARY KEY,
  emailNotifications BOOLEAN NOT NULL DEFAULT 1,
  systemNotifications BOOLEAN NOT NULL DEFAULT 1,
  importantOnly BOOLEAN NOT NULL DEFAULT 0,
  failureNotificationsOnly BOOLEAN NOT NULL DEFAULT 1,
  emailDigestFrequency TEXT NOT NULL DEFAULT 'never',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
```

### Core Components

1. **notification-preferences.ts**: CRUD operations for user preferences
2. **notification-helpers.ts**: Helper functions to check if notifications should be sent
3. **notification-queue.ts**: Queue processing with preference-based filtering
4. **notification-digest.ts**: Digest email generation and sending
5. **email.ts**: Email templates for failure notifications and digests

### Default Preferences

When a new user is created, default preferences are automatically set:

- Email Notifications: **Enabled**
- System Notifications: **Enabled**
- Important Only: **Disabled**
- Failure Notifications Only: **Enabled** (reduces noise)
- Email Digest Frequency: **Never**

### Integration Points

#### Queue Processing

The notification queue processor checks user preferences before sending failure notification emails:

```typescript
// In processQueue()
if (notification failed after max retries) {
  // Send email notification if user has it enabled
  await sendFailureNotificationEmail(notification);
}
```

#### Digest Emails

Scheduled tasks check every hour to send digest emails at the appropriate times:

```typescript
// In scheduled-tasks.ts
digestInterval = setInterval(async () => {
  await sendScheduledDigests();
}, 60 * 60 * 1000); // Check every hour
```

### API Endpoints

Server actions are available for managing preferences:

- `getNotificationPreferencesAction()`: Fetch current user's preferences
- `updateNotificationPreferencesAction(data)`: Update preferences

These are used by the UI and can be called from server components.

## Migration

A migration (`013-ensure-notification-preferences`) ensures all existing users have default notification preferences created. This runs automatically on application startup.

## Configuration

### SMTP Settings

Email notifications require SMTP to be configured in the database. Navigate to:

**Dashboard → Settings → SMTP Configuration**

Required settings:
- SMTP Host
- SMTP Port
- SMTP Username
- SMTP Password (optional)
- From Email Address
- App Base URL

### Environment Variables

No additional environment variables are required specifically for notification preferences. The system uses the existing SMTP configuration from the database.

## Usage Examples

### Checking if a User Should Receive Notifications

```typescript
import { shouldSendNotification } from '@/lib/notification-helpers';

const result = await shouldSendNotification(userId, notification);
if (result.shouldSend) {
  // Send the notification
} else {
  console.log(`Skipping notification: ${result.reason}`);
}
```

### Sending a Digest Email Manually

```typescript
import { sendDigestEmails } from '@/lib/notification-digest';

// Send weekly digests to all users who opted in
const result = await sendDigestEmails('weekly');
console.log(`Sent ${result.sent} digests, ${result.failed} failed`);
```

### Creating Preferences for a New User

```typescript
import { ensureNotificationPreferences } from '@/lib/notification-preferences';

// This creates default preferences if they don't exist
await ensureNotificationPreferences(userId);
```

## Future Enhancements

Potential improvements to the notification preferences system:

1. **System Notifications**: Implement browser push notifications
2. **Webhook Notifications**: Allow users to receive notifications via webhook
3. **Custom Filters**: Let users create custom rules for notifications
4. **Notification History**: Show a log of all notifications sent to a user
5. **Per-Integration Settings**: Allow different preferences for different integrations
6. **Quiet Hours**: Let users specify times when they don't want notifications
7. **Success Notifications**: Optionally notify on successful deliveries
8. **Slack/Discord Integration**: Send notifications to communication platforms

## Troubleshooting

### Not Receiving Email Notifications

1. Check SMTP settings in Dashboard → Settings
2. Verify email notifications are enabled in your preferences
3. Check that your email address is correct in your user profile
4. Look for email sending errors in the application logs

### Digest Emails Not Arriving

1. Verify your digest frequency setting is not "Never"
2. Check that you have notifications in the selected time period
3. Ensure the scheduled tasks are running (check application logs)
4. Verify SMTP configuration is correct

### Preferences Not Saving

1. Check browser console for errors
2. Verify you're logged in as the correct user
3. Check application logs for server-side errors
4. Ensure the database has the notification_preferences table

## Support

For issues or questions about notification preferences, please:

1. Check the application logs for error messages
2. Review this documentation
3. Open an issue on the project repository
4. Contact the system administrator
