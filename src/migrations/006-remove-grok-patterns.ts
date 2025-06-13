import Database from 'better-sqlite3';

const migration = {
  name: 'remove-grok-patterns',
  up: (db: Database.Database): void => {
    // Drop the grok_patterns and template_mappings tables if they exist
    db.exec(`
      DROP TABLE IF EXISTS template_mappings;
      DROP TABLE IF EXISTS grok_patterns;
    `);
    // Remove grokPatternId column from integrations if it exists
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS __temp_integrations AS SELECT * FROM integrations;
      `);
      const pragma = db.prepare("PRAGMA table_info(integrations)").all();
      // SQLite PRAGMA results have a predictable structure but we'll use a safer approach
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (pragma.some((col: any) => col.name === 'grokPatternId')) {
        db.exec(`
          CREATE TABLE integrations_new AS SELECT id, name, platform, webhookUrl, enabled, targetFormat, fieldFilterId, createdAt, userId FROM integrations;
          DROP TABLE integrations;
          ALTER TABLE integrations_new RENAME TO integrations;
        `);
      }
      db.exec(`DROP TABLE IF EXISTS __temp_integrations;`);
    } catch {
      // Ignore if column does not exist
    }
  },
  down: (db: Database.Database): void => {
    // Recreate grok_patterns and template_mappings tables (structure only, no data restoration)
    db.exec(`
      CREATE TABLE IF NOT EXISTS grok_patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        filterPattern TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS template_mappings (
        id TEXT PRIMARY KEY,
        grokPatternId TEXT NOT NULL,
        platform TEXT NOT NULL,
        template TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(grokPatternId) REFERENCES grok_patterns(id) ON DELETE CASCADE
      );
      ALTER TABLE integrations ADD COLUMN grokPatternId TEXT;
    `);
  }
};

export default migration;
