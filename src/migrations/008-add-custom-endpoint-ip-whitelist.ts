import Database from 'better-sqlite3';

const migration = {
  name: 'add-custom-endpoint-ip-whitelist',
  up: (db: Database.Database): void => {
    // Add IP whitelist column to api_endpoints table
    // This will store a JSON array of IP addresses that are allowed to access this specific endpoint
    db.exec(`
      ALTER TABLE api_endpoints 
      ADD COLUMN ipWhitelist TEXT DEFAULT '[]';
    `);
    
    // Set default empty array for existing endpoints
    db.exec(`
      UPDATE api_endpoints 
      SET ipWhitelist = '[]' 
      WHERE ipWhitelist IS NULL;
    `);
  },
  down: (db: Database.Database): void => {
    // SQLite doesn't support dropping columns directly, so we need to recreate the table
    db.exec(`
      CREATE TABLE api_endpoints_temp AS 
      SELECT id, name, path, associatedIntegrationIds, createdAt, description 
      FROM api_endpoints;
      
      DROP TABLE api_endpoints;
      
      ALTER TABLE api_endpoints_temp RENAME TO api_endpoints;
    `);
  }
};

export default migration;
