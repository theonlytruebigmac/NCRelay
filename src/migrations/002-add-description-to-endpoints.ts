import Database from 'better-sqlite3';

const migration = {
  name: 'add-description-to-endpoints',
  up: (db: Database.Database): void => {
    // Add a description column to api_endpoints table
    db.exec(`
      ALTER TABLE api_endpoints 
      ADD COLUMN description TEXT;
    `);
  },
  down: (db: Database.Database): void => {
    // SQLite doesn't support dropping columns directly
    db.exec(`
      CREATE TABLE api_endpoints_temp AS 
      SELECT id, name, path, associatedIntegrationIds, createdAt 
      FROM api_endpoints;
      DROP TABLE api_endpoints;
      ALTER TABLE api_endpoints_temp RENAME TO api_endpoints;
    `);
  }
};

export default migration;
