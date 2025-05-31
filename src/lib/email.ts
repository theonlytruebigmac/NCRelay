
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
