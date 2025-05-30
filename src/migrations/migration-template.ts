import Database from 'better-sqlite3';

/**
 * Migration template
 * Copy this file and rename to: {NNN}-description.ts
 * where NNN is the next migration number (e.g., 002)
 */
export default {
  // Name of the migration (used for logging)
  name: 'migration-description',
  
  // The up function that performs the migration
  up: (db: Database.Database): void => {
    // Add your migration SQL statements here
    // Example:
    // db.exec(`
    //   ALTER TABLE table_name
    //   ADD COLUMN new_column TEXT;
    // `);
  },

  // The down function that reverts the migration
  down: (db: Database.Database): void => {
    // Add your rollback SQL statements here
  }
};
