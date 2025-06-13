import Database from 'better-sqlite3';
import { Migration } from ".";

export const migration: Migration = {
  id: 5,
  name: "Add field filters table",
  
  up: (db: Database.Database): void => {
    // Create field filters table
    db.exec(`
      CREATE TABLE IF NOT EXISTS field_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        included_fields TEXT NOT NULL,
        excluded_fields TEXT NOT NULL,
        description TEXT,
        sample_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    
    // Add field_filter_id column to integrations table
    db.exec(`
      ALTER TABLE integrations ADD COLUMN field_filter_id TEXT;
    `);
  },

  down: (db: Database.Database): void => {
    // Remove field_filter_id column from integrations
    db.exec(`
      CREATE TABLE integrations_temp AS SELECT
        id, name, platform, webhook_url, enabled, target_format, grok_pattern_id
      FROM integrations;
    `);
    
    db.exec(`
      DROP TABLE integrations;
    `);
    
    db.exec(`
      ALTER TABLE integrations_temp RENAME TO integrations;
    `);
    
    // Drop field_filters table
    db.exec(`
      DROP TABLE IF EXISTS field_filters;
    `);
  }
};
