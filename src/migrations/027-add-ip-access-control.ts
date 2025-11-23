import Database from 'better-sqlite3';

const migration = {
  name: 'add-ip-access-control',
  up: (db: Database.Database): void => {
    console.log('Running migration 027: Add IP whitelist/blacklist tables...');
    
    // Global IP Whitelist - system-wide trusted IPs
    db.exec(`
      CREATE TABLE IF NOT EXISTS global_ip_whitelist (
        id TEXT PRIMARY KEY,
        ipAddress TEXT NOT NULL UNIQUE,
        reason TEXT,
        addedBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (addedBy) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Global IP Blacklist - system-wide blocked IPs
    db.exec(`
      CREATE TABLE IF NOT EXISTS global_ip_blacklist (
        id TEXT PRIMARY KEY,
        ipAddress TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        isPermanent INTEGER NOT NULL DEFAULT 0,
        expiresAt TEXT,
        addedBy TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (addedBy) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Create index for expiration queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_global_blacklist_expires 
      ON global_ip_blacklist(expiresAt) 
      WHERE expiresAt IS NOT NULL;
    `);
    
    // Tenant IP Whitelist - per-tenant trusted IPs
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenant_ip_whitelist (
        id TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL,
        ipAddress TEXT NOT NULL,
        reason TEXT,
        addedBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(tenantId, ipAddress),
        FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (addedBy) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Tenant IP Blacklist - per-tenant blocked IPs
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenant_ip_blacklist (
        id TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL,
        ipAddress TEXT NOT NULL,
        reason TEXT NOT NULL,
        isPermanent INTEGER NOT NULL DEFAULT 0,
        expiresAt TEXT,
        addedBy TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE(tenantId, ipAddress),
        FOREIGN KEY (tenantId) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (addedBy) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Create index for tenant blacklist expiration queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tenant_blacklist_expires 
      ON tenant_ip_blacklist(expiresAt) 
      WHERE expiresAt IS NOT NULL;
    `);
    
    // Create index for tenant lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tenant_whitelist_tenant 
      ON tenant_ip_whitelist(tenantId);
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tenant_blacklist_tenant 
      ON tenant_ip_blacklist(tenantId);
    `);
    
    console.log('✅ Migration 027: Created IP access control tables');
  },

  down: (db: Database.Database): void => {
    console.log('Rolling back migration 027: Remove IP access control tables...');
    
    db.exec(`DROP INDEX IF EXISTS idx_tenant_blacklist_tenant;`);
    db.exec(`DROP INDEX IF EXISTS idx_tenant_whitelist_tenant;`);
    db.exec(`DROP INDEX IF EXISTS idx_tenant_blacklist_expires;`);
    db.exec(`DROP INDEX IF EXISTS idx_global_blacklist_expires;`);
    db.exec(`DROP TABLE IF EXISTS tenant_ip_blacklist;`);
    db.exec(`DROP TABLE IF EXISTS tenant_ip_whitelist;`);
    db.exec(`DROP TABLE IF EXISTS global_ip_blacklist;`);
    db.exec(`DROP TABLE IF EXISTS global_ip_whitelist;`);
    
    console.log('✅ Rolled back migration 027');
  }
};

export default migration;
