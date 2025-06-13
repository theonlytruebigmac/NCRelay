import type { NotificationPreferences } from "@/lib/types";

export function getNotificationPreferencesAction(): Promise<NotificationPreferences | null>;
export function updateNotificationPreferencesAction(formData: FormData | any): Promise<NotificationPreferences>;
