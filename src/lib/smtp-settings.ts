import { getDB } from './db';
import { encrypt, decrypt } from './crypto';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

export interface SmtpSettings {
  id: string;
  tenantId: string;
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
  fromAddress: string;
  fromName: string | null;
  useTLS: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpSettingsInput {
  host: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  fromName?: string;
  useTLS?: boolean;
}

/**
 * Get SMTP settings for a tenant
 */
export async function getTenantSmtpSettings(tenantId: string): Promise<SmtpSettings | null> {
  const db = await getDB();
  
  const settings = db.prepare(`
    SELECT * FROM tenant_smtp_settings
    WHERE tenantId = ?
  `).get(tenantId) as SmtpSettings | undefined;

  return settings || null;
}

/**
 * Get decrypted SMTP password
 */
export async function getDecryptedSmtpPassword(tenantId: string): Promise<string | null> {
  const settings = await getTenantSmtpSettings(tenantId);
  if (!settings) return null;

  try {
    return decrypt(settings.encryptedPassword);
  } catch (error) {
    console.error('Failed to decrypt SMTP password:', error);
    return null;
  }
}

/**
 * Create or update SMTP settings for a tenant
 */
export async function upsertTenantSmtpSettings(
  tenantId: string,
  settings: SmtpSettingsInput
): Promise<void> {
  const db = await getDB();
  const now = new Date().toISOString();
  
  // Encrypt password
  const encryptedPassword = encrypt(settings.password);

  // Check if settings exist
  const existing = await getTenantSmtpSettings(tenantId);

  if (existing) {
    // Update
    db.prepare(`
      UPDATE tenant_smtp_settings
      SET host = ?, port = ?, username = ?, encryptedPassword = ?,
          fromAddress = ?, fromName = ?, useTLS = ?, updatedAt = ?
      WHERE tenantId = ?
    `).run(
      settings.host,
      settings.port,
      settings.username,
      encryptedPassword,
      settings.fromAddress,
      settings.fromName || null,
      settings.useTLS ? 1 : 0,
      now,
      tenantId
    );
  } else {
    // Insert
    const id = uuidv4();
    db.prepare(`
      INSERT INTO tenant_smtp_settings (
        id, tenantId, host, port, username, encryptedPassword,
        fromAddress, fromName, useTLS, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      settings.host,
      settings.port,
      settings.username,
      encryptedPassword,
      settings.fromAddress,
      settings.fromName || null,
      settings.useTLS ? 1 : 0,
      now,
      now
    );
  }
}

/**
 * Delete SMTP settings for a tenant
 */
export async function deleteTenantSmtpSettings(tenantId: string): Promise<void> {
  const db = await getDB();
  db.prepare('DELETE FROM tenant_smtp_settings WHERE tenantId = ?').run(tenantId);
}

/**
 * Create nodemailer transporter from tenant SMTP settings
 */
export async function createTenantTransporter(tenantId: string): Promise<nodemailer.Transporter | null> {
  const settings = await getTenantSmtpSettings(tenantId);
  if (!settings) return null;

  const password = await getDecryptedSmtpPassword(tenantId);
  if (!password) return null;

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.useTLS,
    auth: {
      user: settings.username,
      pass: password,
    },
  });
}

/**
 * Test SMTP settings by sending a test email
 */
export async function testSmtpSettings(
  settings: SmtpSettingsInput,
  testEmailTo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.useTLS,
      auth: {
        user: settings.username,
        pass: settings.password,
      },
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `"${settings.fromName || 'NCRelay'}" <${settings.fromAddress}>`,
      to: testEmailTo,
      subject: 'SMTP Test - Configuration Successful',
      text: 'This is a test email to verify your SMTP configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">SMTP Configuration Test</h2>
          <p>Your SMTP settings have been configured successfully!</p>
          <p>This test email confirms that:</p>
          <ul>
            <li>Connection to SMTP server is working</li>
            <li>Authentication credentials are correct</li>
            <li>Email sending is functional</li>
          </ul>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            You can now use this SMTP configuration to send emails from your tenant.
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error: any) {
    console.error('SMTP test failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to send test email',
    };
  }
}
