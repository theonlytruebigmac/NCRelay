"use server";

import { getDB } from "@/lib/db";
import type { NotificationPreferences } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type { NotificationPreferences };

export async function getNotificationPreferencesAction(): Promise<NotificationPreferences | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized access");
  }

  const db = await getDB();
  const prefs = db.prepare('SELECT * FROM notification_preferences WHERE userId = ?').get(user.id) as NotificationPreferences | undefined;

  return prefs || null;
}

export async function updateNotificationPreferencesAction(formData: FormData | any): Promise<NotificationPreferences> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized access");
  }

  // Convert FormData to object if needed
  const data = formData instanceof FormData ? Object.fromEntries(formData) : formData;

  const db = await getDB();
  const now = new Date().toISOString();

  // Check if preferences exist
  const existingPrefs = await getNotificationPreferencesAction();

  if (existingPrefs) {
    // Update existing preferences
    db.prepare(
      `UPDATE notification_preferences SET
        emailNotifications = ?,
        systemNotifications = ?,
        importantOnly = ?,
        failureNotificationsOnly = ?,
        emailDigestFrequency = ?,
        updatedAt = ?
      WHERE userId = ?`
    ).run(
      data.emailNotifications ? 1 : 0,
      data.systemNotifications ? 1 : 0,
      data.importantOnly ? 1 : 0,
      data.failureNotificationsOnly ? 1 : 0,
      data.emailDigestFrequency,
      now,
      user.id
    );
  } else {
    // Create new preferences
    db.prepare(
      `INSERT INTO notification_preferences (
        userId,
        emailNotifications,
        systemNotifications,
        importantOnly,
        failureNotificationsOnly,
        emailDigestFrequency,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.id,
      data.emailNotifications ? 1 : 0,
      data.systemNotifications ? 1 : 0,
      data.importantOnly ? 1 : 0,
      data.failureNotificationsOnly ? 1 : 0,
      data.emailDigestFrequency,
      now,
      now
    );
  }

  // Revalidate the settings page
  revalidatePath('/dashboard/settings/notifications');

  // Return updated preferences
  const updatedPrefs = await getNotificationPreferencesAction();
  if (!updatedPrefs) {
    throw new Error("Failed to update notification preferences");
  }

  return updatedPrefs;
}

const actions = {
  getNotificationPreferences: getNotificationPreferencesAction,
  updateNotificationPreferences: updateNotificationPreferencesAction,
};

export default actions;
