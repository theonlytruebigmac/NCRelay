import { sendEmail } from './email';

interface WelcomeEmailOptions {
  toEmail: string;
  userName: string;
  password?: string;
  tenantId?: string;
  tenantName?: string;
  isNewUser: boolean;
}

/**
 * Send welcome email to new users or users added to a tenant
 */
export async function sendWelcomeEmail(options: WelcomeEmailOptions): Promise<void> {
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetPasswordUrl = `${loginUrl}/forgot-password`;

  const subject = options.isNewUser 
    ? `Welcome to ${options.tenantName || 'NCRelay'}!`
    : `You've been added to ${options.tenantName || 'NCRelay'}`;

  let text = '';
  let html = '';

  if (options.isNewUser && options.password) {
    // New user with password
    text = `Welcome to ${options.tenantName || 'NCRelay'}!\n\n` +
           `An account has been created for you.\n\n` +
           `Login Details:\n` +
           `Email: ${options.toEmail}\n` +
           `Temporary Password: ${options.password}\n\n` +
           `You can log in at: ${loginUrl}/login\n\n` +
           `For security reasons, we recommend changing your password after your first login.\n` +
           `You can reset your password at any time by visiting: ${resetPasswordUrl}\n\n` +
           `If you have any questions, please contact your administrator.`;

    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Welcome to ${options.tenantName || 'NCRelay'}!</h1>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 24px; color: #374151;">Hi ${options.userName},</p>
          
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            An account has been created for you. Here are your login credentials:
          </p>
          
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #111827;">Login Details:</p>
            <p style="margin: 4px 0; color: #374151;"><strong>Email:</strong> ${options.toEmail}</p>
            <p style="margin: 4px 0; color: #374151;"><strong>Temporary Password:</strong> <code style="background-color: #E5E7EB; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${options.password}</code></p>
          </div>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${loginUrl}/login" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Log In Now</a>
          </div>
          
          <div style="background-color: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0; color: #991B1B; font-size: 14px;">
              <strong>🔒 Security Tip:</strong> We strongly recommend changing your password after your first login. You can reset your password at any time from the <a href="${resetPasswordUrl}" style="color: #991B1B; text-decoration: underline;">Forgot Password</a> page.
            </p>
          </div>
          
          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please contact your administrator.
          </p>
        </div>
        
        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #E5E7EB;">
          <p style="margin: 0; color: #6B7280; font-size: 12px;">
            This email was sent to ${options.toEmail} by ${options.tenantName || 'NCRelay'}
          </p>
        </div>
      </div>
    `;
  } else if (options.isNewUser && !options.password) {
    // New user without password (needs to reset)
    text = `Welcome to ${options.tenantName || 'NCRelay'}!\n\n` +
           `An account has been created for you with the email: ${options.toEmail}\n\n` +
           `To set your password and access your account, please visit:\n${resetPasswordUrl}\n\n` +
           `Enter your email address to receive a password reset link.\n\n` +
           `If you have any questions, please contact your administrator.`;

    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Welcome to ${options.tenantName || 'NCRelay'}!</h1>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 24px; color: #374151;">Hi ${options.userName},</p>
          
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            An account has been created for you with the email address: <strong>${options.toEmail}</strong>
          </p>
          
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            To set your password and access your account, please click the button below:
          </p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${resetPasswordUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Set Your Password</a>
          </div>
          
          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
            Enter your email address on the password reset page to receive a secure link to set your password.
          </p>
        </div>
        
        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #E5E7EB;">
          <p style="margin: 0; color: #6B7280; font-size: 12px;">
            This email was sent to ${options.toEmail} by ${options.tenantName || 'NCRelay'}
          </p>
        </div>
      </div>
    `;
  } else {
    // Existing user added to tenant
    text = `You've been added to ${options.tenantName || 'a new tenant'}!\n\n` +
           `Hi ${options.userName},\n\n` +
           `You've been added to ${options.tenantName || 'a new tenant'} on NCRelay.\n\n` +
           `You can access it using your existing login credentials at:\n${loginUrl}/login\n\n` +
           `If you've forgotten your password, you can reset it at:\n${resetPasswordUrl}\n\n` +
           `If you have any questions, please contact your administrator.`;

    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px;">New Tenant Access</h1>
        </div>
        
        <div style="padding: 40px 30px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 24px; color: #374151;">Hi ${options.userName},</p>
          
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            You've been added to <strong>${options.tenantName || 'a new tenant'}</strong> on NCRelay.
          </p>
          
          <p style="font-size: 16px; line-height: 24px; color: #374151;">
            You can access it using your existing login credentials.
          </p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${loginUrl}/login" style="display: inline-block; background-color: #4F46E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Log In Now</a>
          </div>
          
          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
            If you've forgotten your password, you can reset it at any time from the <a href="${resetPasswordUrl}" style="color: #4F46E5; text-decoration: underline;">Forgot Password</a> page.
          </p>
        </div>
        
        <div style="background-color: #F9FAFB; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #E5E7EB;">
          <p style="margin: 0; color: #6B7280; font-size: 12px;">
            This email was sent to ${options.toEmail} by ${options.tenantName || 'NCRelay'}
          </p>
        </div>
      </div>
    `;
  }

  try {
    await sendEmail({
      to: options.toEmail,
      subject,
      text,
      html,
      tenantId: options.tenantId,
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - email failure shouldn't block user creation
  }
}
