import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Import all migrations statically
// When adding a new migration, import it here
import migration001 from './001-initial-schema';
import migration002 from './002-add-description-to-endpoints';
import migration003 from './003-add-security-settings';
import migration004 from './004-add-grok-patterns';
import { migration as migration005 } from './005-add-field-filters';
import migration006 from './006-remove-grok-patterns';
import migration007 from './007-remove-target-format';
// Add new migration imports here...

const DB_PATH = process.env.NODE_ENV === 'production' ? '/data/app.db' : path.join(process.cwd(), 'app.db');

// Migration interface
export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
  down: (db: Database.Database) => void;
}

// Create migrations table if it doesn't exist
function ensureMigrationsTable(db: Database.Database): void {
  const createMigrationsTable = `
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `;
  db.exec(createMigrationsTable);
}

// Get all applied migrations
function getAppliedMigrations(db: Database.Database): number[] {
  try {
    const stmt = db.prepare('SELECT id FROM migrations ORDER BY id ASC');
    const rows = stmt.all() as { id: number }[];
    return rows.map(row => row.id);
  } catch (error) {
    return [];
  }
}

// Register all migrations
function getAllMigrations(): Migration[] {
  // Define migrations with their ID and implementation
  const migrations: Migration[] = [
    {
      id: 1,
      name: migration001.name || 'initial-schema',
      up: migration001.up,
      down: migration001.down
    },
    {
      id: 2,
      name: migration002.name || 'add-description-to-endpoints',
      up: migration002.up,
      down: migration002.down
    },
    {
      id: 3,
      name: migration003.name || 'add-security-settings',
      up: migration003.up,
      down: migration003.down
    },
    {
      id: 4,
      name: migration004.name || 'add-grok-patterns',
      up: migration004.up,
      down: migration004.down
    },
    migration005,
    {
      id: 6,
      name: migration006.name || 'remove-grok-patterns',
      up: migration006.up,
      down: migration006.down
    },
    {
      id: 7,
      name: migration007.name || 'remove-target-format',
      up: migration007.up,
      down: migration007.down
    },
  ];
  
  return migrations.sort((a, b) => a.id - b.id);
}

// Run migrations
export async function runMigrations(): Promise<void> {
  console.log('Starting migration process...');
  console.log(`Using database at ${DB_PATH}`);
  
  const db = new Database(DB_PATH);
  
  try {
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Ensure migrations table exists
    ensureMigrationsTable(db);
    
    // Get applied migrations
    const appliedMigrationIds = new Set(getAppliedMigrations(db));
    
    // Get all migrations
    const migrations = getAllMigrations();
    
    // Apply pending migrations
    let appliedCount = 0;
    
    for (const migration of migrations) {
      if (!appliedMigrationIds.has(migration.id)) {
        console.log(`Applying migration ${migration.id}: ${migration.name}`);
        try {
          // Run the migration
          migration.up(db);
          
          // Record the migration as applied
          const stmt = db.prepare('INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)');
          stmt.run(migration.id, migration.name, new Date().toISOString());
          
          appliedCount++;
          console.log(`Successfully applied migration ${migration.id}: ${migration.name}`);
        } catch (error) {
          console.error(`Failed to apply migration ${migration.id}: ${migration.name}`, error);
          throw error;
        }
      } else {
        console.log(`Migration ${migration.id}: ${migration.name} already applied, skipping`);
      }
    }
    
    if (appliedCount > 0) {
      console.log(`Applied ${appliedCount} database migrations`);
    } else {
      console.log('Database schema is up to date, no migrations applied');
    }
    
  } finally {
    // Close database connection
    db.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}
