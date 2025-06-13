const migration = {
    name: 'add-userid-to-integrations',
    up: (db) => {
        // Add userId column to integrations table
        db.exec(`
      ALTER TABLE integrations ADD COLUMN userId TEXT;
    `);
        // Add foreign key index for better performance
        db.exec(`
      CREATE INDEX idx_integrations_userId ON integrations(userId);
    `);
        console.log('✅ Added userId column to integrations table');
    },
    down: (db) => {
        // Remove the userId column (note: SQLite doesn't support DROP COLUMN directly)
        // This would require recreating the table, but for safety we'll leave it
        console.log('⚠️  Cannot remove userId column from integrations table (SQLite limitation)');
    }
};
export default migration;
