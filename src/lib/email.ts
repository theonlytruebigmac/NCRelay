
'use server';

import nodemailer from 'nodemailer';
import * as db from '@/lib/db'; // To fetch SMTP settings

interface MailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const settings = await db.getSmtpSettings();
  if (!settings || !settings.host || !settings.user || !settings.fromEmail || !settings.appBaseUrl) {
    console.warn(
      'SMTP settings are not fully configured in the database. Email sending will be disabled.'
    );
    return null;
  }
  // Password can be empty if SMTP server does not require auth, but usually it's needed.
  // Nodemailer handles empty password if auth method allows.

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password || '', // Use empty string if password is not set
    },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const transporter = await getTransporter();
  const settings = await db.getSmtpSettings(); // Fetch settings again for appBaseUrl and fromEmail

  if (!transporter || !settings || !settings.fromEmail || !settings.appBaseUrl) {
    console.error('Email service is not configured or appBaseUrl/fromEmail is missing. Cannot send password reset email.');
    throw new Error('Email service not configured or essential settings missing.');
  }

  const resetLink = `${settings.appBaseUrl}/reset-password?token=${token}`;

  const mailOptions: MailOptions = {
    to,
    from: settings.fromEmail,
    subject: 'NCRelay - Password Reset Request',
    text: `You requested a password reset. Click this link to reset your password: ${resetLink}\n\nIf you did not request this, please ignore this email. This link will expire in 1 hour.`,
    html: `<p>You requested a password reset. Click the link below to reset your password:</p>
           <p><a href="${resetLink}">${resetLink}</a></p>
           <p>If you did not request this, please ignore this email. This link will expire in 1 hour.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${to}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Could not send password reset email.');
  }
}

export async function sendNotificationFailureEmail(
  to: string,
  notificationDetails: {
    integrationName: string;
    platform: string;
    apiEndpointName: string;
    errorDetails?: string;
    retryCount: number;
    maxRetries: number;
    timestamp: string;
  }
): Promise<void> {
  const transporter = await getTransporter();
  const settings = await db.getSmtpSettings();

  if (!transporter || !settings || !settings.fromEmail || !settings.appBaseUrl) {
    console.error('Email service is not configured. Cannot send notification failure email.');
    return; // Silently fail for notification emails
  }

  const dashboardLink = `${settings.appBaseUrl}/dashboard/logs`;
  const formattedTimestamp = new Date(notificationDetails.timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const mailOptions: MailOptions = {
    to,
    from: settings.fromEmail,
    subject: `🚨 NCRelay - Notification Delivery Failed: ${notificationDetails.integrationName}`,
    text: `NOTIFICATION DELIVERY FAILED\n\n` +
          `A notification delivery has failed for your integration "${notificationDetails.integrationName}".\n\n` +
          `Platform: ${notificationDetails.platform}\n` +
          `API Endpoint: ${notificationDetails.apiEndpointName}\n` +
          `Retry Attempt: ${notificationDetails.retryCount}/${notificationDetails.maxRetries}\n` +
          `Timestamp: ${formattedTimestamp}\n\n` +
          `${notificationDetails.errorDetails ? `Error: ${notificationDetails.errorDetails}\n\n` : ''}` +
          `View details in your dashboard: ${dashboardLink}\n\n` +
          `---\n` +
          `This is an automated message from NCRelay. If you have questions, please check your dashboard or contact your system administrator.`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Delivery Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">⚠️ Notification Delivery Failed</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 24px;">
                A notification delivery has failed after all retry attempts for your integration:
              </p>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 18px;">${notificationDetails.integrationName}</p>
              </div>
              
              <!-- Details Table -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; width: 40%;">Platform</td>
                        <td style="color: #111827; font-size: 14px;">${notificationDetails.platform}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; width: 40%;">API Endpoint</td>
                        <td style="color: #111827; font-size: 14px;">${notificationDetails.apiEndpointName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; width: 40%;">Retry Attempts</td>
                        <td style="color: #111827; font-size: 14px;">
                          <span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                            ${notificationDetails.retryCount}/${notificationDetails.maxRetries}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; font-weight: 600; width: 40%;">Timestamp</td>
                        <td style="color: #111827; font-size: 14px;">${formattedTimestamp}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${notificationDetails.errorDetails ? `
              <!-- Error Details -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; margin: 24px 0; border-radius: 6px;">
                <p style="margin: 0 0 8px; color: #991b1b; font-weight: 600; font-size: 14px;">Error Details:</p>
                <p style="margin: 0; color: #7f1d1d; font-size: 13px; font-family: 'Courier New', monospace; word-break: break-word;">${notificationDetails.errorDetails}</p>
              </div>
              ` : ''}
              
              <!-- Action Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${dashboardLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">View Logs in Dashboard</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 20px;">
                <strong>What to do next:</strong><br>
                • Check the error details and your integration configuration<br>
                • Verify the webhook URL is accessible<br>
                • Review your logs for more information<br>
                • Adjust your notification preferences in settings if needed
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 18px; text-align: center;">
                This is an automated message from <strong>NCRelay</strong>.<br>
                To manage your notification preferences, visit <a href="${settings.appBaseUrl}/dashboard/settings/notifications" style="color: #3b82f6; text-decoration: none;">Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Notification failure email sent to ${to}`);
  } catch (error) {
    console.error('Error sending notification failure email:', error);
  }
}

export async function sendNotificationDigestEmail(
  to: string,
  period: string,
  summary: {
    totalNotifications: number;
    successfulNotifications: number;
    failedNotifications: number;
    topIntegrations: Array<{ name: string; count: number }>;
  }
): Promise<void> {
  const transporter = await getTransporter();
  const settings = await db.getSmtpSettings();

  if (!transporter || !settings || !settings.fromEmail || !settings.appBaseUrl) {
    console.error('Email service is not configured. Cannot send notification digest email.');
    return;
  }

  const dashboardLink = `${settings.appBaseUrl}/dashboard`;
  const logsLink = `${settings.appBaseUrl}/dashboard/logs`;
  const queueLink = `${settings.appBaseUrl}/dashboard/queue`;
  
  const successRate = summary.totalNotifications > 0 
    ? Math.round((summary.successfulNotifications / summary.totalNotifications) * 100) 
    : 0;
  
  const topIntegrationsList = summary.topIntegrations
    .map((int, idx) => `${idx + 1}. ${int.name}: ${int.count} notifications`)
    .join('\n');

  const topIntegrationsHtml = summary.topIntegrations
    .map((int, idx) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 600;">#${idx + 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${int.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #3b82f6; font-weight: 600; text-align: right;">${int.count}</td>
      </tr>
    `)
    .join('');

  const mailOptions: MailOptions = {
    to,
    from: settings.fromEmail,
    subject: `📊 NCRelay - Your ${period} Notification Summary`,
    text: `YOUR ${period.toUpperCase()} NOTIFICATION SUMMARY\n\n` +
          `Here's your notification summary for the past ${period.toLowerCase()}:\n\n` +
          `Total Notifications: ${summary.totalNotifications}\n` +
          `Successful: ${summary.successfulNotifications} (${successRate}%)\n` +
          `Failed: ${summary.failedNotifications}\n\n` +
          `${summary.topIntegrations.length > 0 ? `Top Integrations:\n${topIntegrationsList}\n\n` : ''}` +
          `View full details in your dashboard: ${dashboardLink}\n\n` +
          `---\n` +
          `This is your scheduled digest from NCRelay. You can change your digest frequency in your notification preferences.`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${period} Notification Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">📊 ${period} Notification Summary</h1>
              <p style="margin: 8px 0 0; color: #dbeafe; font-size: 14px;">Your notification activity overview</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 24px;">
                Here's your notification summary for the past ${period.toLowerCase()}:
              </p>
              
              <!-- Stats Grid -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px;">
                <tr>
                  <!-- Total -->
                  <td style="padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 8px; width: 32%; vertical-align: top;">
                    <p style="margin: 0 0 8px; color: #3b82f6; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total</p>
                    <p style="margin: 0; color: #1e40af; font-size: 32px; font-weight: 700; line-height: 1;">${summary.totalNotifications}</p>
                    <p style="margin: 4px 0 0; color: #60a5fa; font-size: 11px;">notifications</p>
                  </td>
                  <td style="width: 2%;"></td>
                  
                  <!-- Successful -->
                  <td style="padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; width: 32%; vertical-align: top;">
                    <p style="margin: 0 0 8px; color: #16a34a; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Successful</p>
                    <p style="margin: 0; color: #15803d; font-size: 32px; font-weight: 700; line-height: 1;">${summary.successfulNotifications}</p>
                    <p style="margin: 4px 0 0; color: #4ade80; font-size: 11px;">${successRate}% success rate</p>
                  </td>
                  <td style="width: 2%;"></td>
                  
                  <!-- Failed -->
                  <td style="padding: 20px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 8px; width: 32%; vertical-align: top;">
                    <p style="margin: 0 0 8px; color: #dc2626; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Failed</p>
                    <p style="margin: 0; color: #991b1b; font-size: 32px; font-weight: 700; line-height: 1;">${summary.failedNotifications}</p>
                    <p style="margin: 4px 0 0; color: #f87171; font-size: 11px;">need attention</p>
                  </td>
                </tr>
              </table>
              
              ${summary.topIntegrations.length > 0 ? `
              <!-- Top Integrations -->
              <div style="margin: 32px 0;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">🏆 Top Integrations</h2>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; width: 50px;">Rank</th>
                      <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Integration</th>
                      <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb;">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${topIntegrationsHtml}
                  </tbody>
                </table>
              </div>
              ` : `
              <div style="padding: 24px; background-color: #f9fafb; border-radius: 8px; text-align: center; margin: 32px 0;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">No integration activity during this period</p>
              </div>
              `}
              
              <!-- Quick Links -->
              <div style="margin: 32px 0;">
                <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px; font-weight: 600;">Quick Links:</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 0 8px 0 0; width: 33%;">
                      <a href="${dashboardLink}" style="display: block; padding: 12px; background-color: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 500;">📊 Dashboard</a>
                    </td>
                    <td style="padding: 0 4px; width: 33%;">
                      <a href="${logsLink}" style="display: block; padding: 12px; background-color: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 500;">📝 View Logs</a>
                    </td>
                    <td style="padding: 0 0 0 8px; width: 33%;">
                      <a href="${queueLink}" style="display: block; padding: 12px; background-color: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; text-align: center; font-size: 13px; font-weight: 500;">⏱️ Queue Status</a>
                    </td>
                  </tr>
                </table>
              </div>
              
              ${summary.failedNotifications > 0 ? `
              <!-- Alert for failures -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #991b1b; font-size: 14px;">
                  <strong>⚠️ Action Required:</strong> You have ${summary.failedNotifications} failed notification${summary.failedNotifications !== 1 ? 's' : ''} that may need your attention.
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; line-height: 18px; text-align: center;">
                This is your scheduled <strong>${period.toLowerCase()}</strong> digest from <strong>NCRelay</strong>.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                To change your digest frequency, visit <a href="${settings.appBaseUrl}/dashboard/settings/notifications" style="color: #3b82f6; text-decoration: none;">Notification Settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Notification digest email sent to ${to}`);
  } catch (error) {
    console.error('Error sending notification digest email:', error);
  }
}
