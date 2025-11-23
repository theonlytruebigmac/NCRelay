import Database from 'better-sqlite3';

export const id = 28;
export const name = 'add-tenant-smtp-settings';

export function up(db: Database.Database): void {
  // Add tenantId column to smtp_settings table
  // NULL tenantId = global/system SMTP config
  // Non-NULL tenantId = tenant-specific SMTP config
  db.exec(`
    -- Add tenantId column (nullable for global config)
    ALTER TABLE smtp_settings ADD COLUMN tenantId TEXT DEFAULT NULL;
    
    -- Create index for tenant lookup
    CREATE INDEX IF NOT EXISTS idx_smtp_settings_tenant ON smtp_settings(tenantId);
    
    -- Add foreign key constraint check (SQLite doesn't enforce foreign keys in ALTER TABLE)
    -- We'll rely on application logic to ensure tenantId references valid tenant
  `);

  console.log('✅ Migration 028: Added tenantId column to smtp_settings table');
}

export function down(db: Database.Database): void {
  // SQLite doesn't support DROP COLUMN directly in older versions
  // We need to recreate the table without the column
  db.exec(`
    -- Create temporary table without tenantId
    CREATE TABLE smtp_settings_backup (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      user TEXT NOT NULL,
      password TEXT NOT NULL,
      secure INTEGER NOT NULL,
      fromEmail TEXT NOT NULL,
      appBaseUrl TEXT NOT NULL
    );
    
    -- Copy data (excluding tenantId)
    INSERT INTO smtp_settings_backup (id, host, port, user, password, secure, fromEmail, appBaseUrl)
    SELECT id, host, port, user, password, secure, fromEmail, appBaseUrl
    FROM smtp_settings;
    
    -- Drop original table
    DROP TABLE smtp_settings;
    
    -- Rename backup to original
    ALTER TABLE smtp_settings_backup RENAME TO smtp_settings;
  `);

  console.log('✅ Migration 028: Removed tenantId column from smtp_settings table');
}
