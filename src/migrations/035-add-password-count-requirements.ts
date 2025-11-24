import type { Database } from 'better-sqlite3';

export const id = 35;
export const name = 'add-password-count-requirements';

export function up(db: Database): void {
  console.log('Running migration 035: Add password count requirements...');

  // Add columns for minimum counts
  db.exec(`
    ALTER TABLE tenant_security_settings ADD COLUMN passwordMinUppercase INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordMinLowercase INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordMinNumbers INTEGER DEFAULT 0;
    ALTER TABLE tenant_security_settings ADD COLUMN passwordMinSymbols INTEGER DEFAULT 0;
  `);

  console.log('✅ Migration 035: Added password count requirement columns');
}

export function down(db: Database): void {
  console.log('Rolling back migration 035: Remove password count requirements...');

  db.exec(`
    ALTER TABLE tenant_security_settings DROP COLUMN passwordMinUppercase;
    ALTER TABLE tenant_security_settings DROP COLUMN passwordMinLowercase;
    ALTER TABLE tenant_security_settings DROP COLUMN passwordMinNumbers;
    ALTER TABLE tenant_security_settings DROP COLUMN passwordMinSymbols;
  `);

  console.log('✅ Rolled back migration 035');
}
