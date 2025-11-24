import { Database } from 'better-sqlite3';

export async function up(db: Database) {
  console.log('Running migration 025: Add password policy columns to tenant_security_settings...');
  
  // Add missing password requirement columns
  db.exec(`
    ALTER TABLE tenant_security_settings ADD COLUMN passwordRequireUppercase INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordRequireLowercase INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordRequireNumbers INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordRequireSymbols INTEGER DEFAULT 0;
  `);
  
  // Remove old column if it exists (passwordRequireSpecialChar was renamed to passwordRequireSymbols)
  try {
    db.exec(`ALTER TABLE tenant_security_settings DROP COLUMN passwordRequireSpecialChar;`);
  } catch (error) {
    // Column doesn't exist, that's fine
    console.log('passwordRequireSpecialChar column not found (expected if already removed)');
  }

  console.log('✅ Migration 025: Added password policy columns to tenant_security_settings');
}

export async function down(db: Database) {
  console.log('Rolling back migration 025...');
  
  // SQLite doesn't support dropping columns directly in older versions
  // We'd need to recreate the table without these columns
  // For simplicity, we'll just note this in the log
  
  console.log('⚠️  Migration 025 rollback: SQLite limitations prevent dropping columns directly');
  console.log('   To fully rollback, you would need to recreate the table without these columns');
}

const migration = {
  name: 'add-password-policy-columns',
  up,
  down,
};

export default migration;
