import Database from 'better-sqlite3';

export default {
  name: 'add-description-to-endpoints',
  up: (db: Database.Database): void => {
    // Add a description column to api_endpoints table
    db.exec(`
      ALTER TABLE api_endpoints 
      ADD COLUMN description TEXT;
    `);
  }
};
