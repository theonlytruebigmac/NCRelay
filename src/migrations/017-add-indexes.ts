import Database from 'better-sqlite3';

/**
 * Add database indexes for improved query performance
 */
const migration = {
  name: 'add-indexes',

  up: (db: Database.Database): void => {
    db.exec(`
      -- Improve request log queries
      CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_request_logs_api_endpoint_id ON request_logs(apiEndpointId);

      -- Improve notification queue queries
      CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
      CREATE INDEX IF NOT EXISTS idx_notification_queue_next_retry ON notification_queue(nextRetryAt);
      CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON notification_queue(createdAt DESC);

      -- Improve integration queries
      CREATE INDEX IF NOT EXISTS idx_integrations_enabled ON integrations(enabled);

      -- Improve user queries
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      -- Improve password reset token queries
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expiresAt);
    `);
  },

  down: (db: Database.Database): void => {
    db.exec(`
      DROP INDEX IF EXISTS idx_request_logs_timestamp;
      DROP INDEX IF EXISTS idx_request_logs_api_endpoint_id;
      DROP INDEX IF EXISTS idx_notification_queue_status;
      DROP INDEX IF EXISTS idx_notification_queue_next_retry;
      DROP INDEX IF EXISTS idx_notification_queue_created_at;
      DROP INDEX IF EXISTS idx_integrations_enabled;
      DROP INDEX IF EXISTS idx_users_email;
      DROP INDEX IF EXISTS idx_password_reset_tokens_token;
      DROP INDEX IF EXISTS idx_password_reset_tokens_expires;
    `);
  }
};

export default migration;
