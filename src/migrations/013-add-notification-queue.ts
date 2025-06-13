import Database from 'better-sqlite3';

export const migration = {
  name: '013-add-notification-queue',
  up(db: Database.Database) {
    // Create notification queue table
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
        priority INTEGER NOT NULL DEFAULT 0, -- Higher number = higher priority
        maxRetries INTEGER NOT NULL DEFAULT 3,
        retryCount INTEGER NOT NULL DEFAULT 0,
        nextRetryAt TEXT, -- ISO date string for next retry attempt
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        lastAttemptAt TEXT,
        integrationId TEXT NOT NULL,
        integrationName TEXT NOT NULL,
        platform TEXT NOT NULL,
        webhookUrl TEXT NOT NULL,
        payload TEXT NOT NULL, -- The formatted payload to send
        contentType TEXT NOT NULL, -- Content type header
        errorDetails TEXT, -- Details about the error if any
        responseStatus INTEGER, -- HTTP status code of the response
        responseBody TEXT, -- Response body
        apiEndpointId TEXT, -- The API endpoint that triggered this notification
        apiEndpointName TEXT, -- The name of the API endpoint
        apiEndpointPath TEXT, -- The path of the API endpoint
        originalRequestId TEXT, -- The ID of the original request log
        FOREIGN KEY (integrationId) REFERENCES integrations(id) ON DELETE CASCADE
      );

      -- Index for faster queue processing
      CREATE INDEX IF NOT EXISTS idx_notification_queue_status 
      ON notification_queue(status, nextRetryAt);
      
      -- Index for finding notifications by integration
      CREATE INDEX IF NOT EXISTS idx_notification_queue_integration 
      ON notification_queue(integrationId);
      
      -- Index for finding notifications by endpoint
      CREATE INDEX IF NOT EXISTS idx_notification_queue_endpoint 
      ON notification_queue(apiEndpointId);
      
      -- Index for finding notifications by original request
      CREATE INDEX IF NOT EXISTS idx_notification_queue_request 
      ON notification_queue(originalRequestId);
    `);
  },
  down(db: Database.Database) {
    db.exec(`
      DROP TABLE IF EXISTS notification_queue;
    `);
  },
};
