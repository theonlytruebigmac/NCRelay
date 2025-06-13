export async function up(db) {
    db.exec(`
    -- Add enabled column to api_endpoints
    ALTER TABLE api_endpoints ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
  `);
}
export async function down(db) {
    // SQLite doesn't support dropping columns directly
    db.exec(`
    BEGIN TRANSACTION;
    
    -- Create temporary table without the enabled column
    CREATE TABLE api_endpoints_temp (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      associatedIntegrationIds TEXT NOT NULL,
      ipWhitelist TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    
    -- Copy data
    INSERT INTO api_endpoints_temp 
    SELECT id, name, path, associatedIntegrationIds, ipWhitelist, createdAt
    FROM api_endpoints;
    
    -- Drop original table
    DROP TABLE api_endpoints;
    
    -- Rename temp table to original
    ALTER TABLE api_endpoints_temp RENAME TO api_endpoints;
    
    COMMIT;
  `);
}
