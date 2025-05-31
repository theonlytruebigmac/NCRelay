/**
 * Migration template
 * Copy this file and rename to: {NNN}-description.ts
 * where NNN is the next migration number (e.g., 002)
 */
const migration = {
    // Name of the migration (used for logging)
    name: 'migration-description',
    // The up function that performs the migration
    up: (_db) => {
        // Add your migration SQL statements here
        // Example:
        // _db.exec(`
        //   ALTER TABLE table_name
        //   ADD COLUMN new_column TEXT;
        // `);
    },
    // The down function that reverts the migration
    down: (_db) => {
        // Add your rollback SQL statements here
    }
};
export default migration;
