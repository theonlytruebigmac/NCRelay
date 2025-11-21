export const migration = {
    name: '013-ensure-notification-preferences',
    up(db) {
        // Get all users
        const users = db.prepare('SELECT id FROM users').all();
        const now = new Date().toISOString();
        // Create default notification preferences for users who don't have them
        const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO notification_preferences (
        userId,
        emailNotifications,
        systemNotifications,
        importantOnly,
        failureNotificationsOnly,
        emailDigestFrequency,
        createdAt,
        updatedAt
      ) VALUES (?, 1, 1, 0, 1, 'never', ?, ?)
    `);
        let created = 0;
        for (const user of users) {
            const result = insertStmt.run(user.id, now, now);
            if (result.changes > 0) {
                created++;
            }
        }
        console.log(`Created default notification preferences for ${created} users`);
    },
    down(db) {
        // No-op - we don't want to remove preferences on rollback
        console.log('Rollback: Not removing notification preferences');
    },
};
