const migration = {
    name: 'add-userid-to-request-logs',
    up: (db) => {
        // Add userId column to the request_logs table
        db.exec(`
      ALTER TABLE request_logs 
      ADD COLUMN userId TEXT;
    `);
    },
    down: (db) => {
        // SQLite doesn't support dropping columns directly
        // We need to create a new table without the column and copy data
        db.exec(`
      CREATE TABLE request_logs_temp (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        apiEndpointId TEXT,
        apiEndpointName TEXT,
        apiEndpointPath TEXT NOT NULL,
        incomingRequestIp TEXT,
        incomingRequestMethod TEXT NOT NULL,
        incomingRequestHeaders TEXT NOT NULL,
        incomingRequestBodyRaw TEXT NOT NULL,
        processingOverallStatus TEXT NOT NULL,
        processingMessage TEXT NOT NULL,
        integrationAttempts TEXT,
        fieldFilterId TEXT
      );
      
      INSERT INTO request_logs_temp
      SELECT
        id, timestamp, apiEndpointId, apiEndpointName, apiEndpointPath,
        incomingRequestIp, incomingRequestMethod, incomingRequestHeaders, 
        incomingRequestBodyRaw, processingOverallStatus, processingMessage,
        integrationAttempts, fieldFilterId
      FROM request_logs;
      
      DROP TABLE request_logs;
      
      ALTER TABLE request_logs_temp RENAME TO request_logs;
    `);
    }
};
export default migration;
