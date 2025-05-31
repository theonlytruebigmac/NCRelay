import Database from 'better-sqlite3';

const migration = {
  name: 'add-grok-patterns',
  up: (db: Database.Database): void => {
    // Create the grok patterns table
    db.exec(`
      CREATE TABLE IF NOT EXISTS grok_patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        filterPattern TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    
    // Create the template mappings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS template_mappings (
        id TEXT PRIMARY KEY,
        grokPatternId TEXT NOT NULL,
        platform TEXT NOT NULL, 
        template TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(grokPatternId) REFERENCES grok_patterns(id) ON DELETE CASCADE
      )
    `);

    // Add a new column to the integrations table to reference a grok pattern
    db.exec(`
      ALTER TABLE integrations
      ADD COLUMN grokPatternId TEXT;
    `);

    // Add a foreign key constraint (SQLite doesn't support adding constraints after table creation)
    // We'll enforce this at the application level
  },
  down: (db: Database.Database): void => {
    // Drop in reverse order of creation
    db.exec(`
      ALTER TABLE integrations DROP COLUMN grokPatternId;
      DROP TABLE IF EXISTS template_mappings;
      DROP TABLE IF EXISTS grok_patterns;
    `);
  }
};

export default migration;
