import Database from 'better-sqlite3';

const migration = {
  name: 'add-tenant-rate-limiting',
  up: (db: Database.Database): void => {
    console.log('Running migration 026: Add tenant-level rate limiting to tenant_security_settings...');
    
    // Add rate limiting columns to tenant_security_settings
    db.exec(`ALTER TABLE tenant_security_settings ADD COLUMN rateLimitEnabled INTEGER DEFAULT 1;`);
    db.exec(`ALTER TABLE tenant_security_settings ADD COLUMN rateLimitMaxRequests INTEGER DEFAULT 100;`);
    db.exec(`ALTER TABLE tenant_security_settings ADD COLUMN rateLimitWindowMs INTEGER DEFAULT 60000;`);
    db.exec(`ALTER TABLE tenant_security_settings ADD COLUMN rateLimitIpWhitelist TEXT DEFAULT '[]';`);
    
    console.log('✅ Migration 026: Added tenant-level rate limiting columns to tenant_security_settings');
  },

  down: (db: Database.Database): void => {
    console.log('Rolling back migration 026: Remove tenant-level rate limiting columns...');
    
    // Remove the rate limiting columns
    db.exec(`ALTER TABLE tenant_security_settings DROP COLUMN rateLimitEnabled;`);
    db.exec(`ALTER TABLE tenant_security_settings DROP COLUMN rateLimitMaxRequests;`);
    db.exec(`ALTER TABLE tenant_security_settings DROP COLUMN rateLimitWindowMs;`);
    db.exec(`ALTER TABLE tenant_security_settings DROP COLUMN rateLimitIpWhitelist;`);
    
    console.log('✅ Rolled back migration 026');
  }
};

export default migration;
