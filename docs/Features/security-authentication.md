# Security & Authentication Features

**Last Updated:** November 22, 2025  
**Status:** ✅ IMPLEMENTED

This document covers the comprehensive security and authentication features implemented in NCRelay, including multi-factor authentication, session management, audit logging, security policies, and rate limiting.

---

## Table of Contents

1. [Multi-Factor Authentication (2FA)](#multi-factor-authentication-2fa)
2. [Active Session Management](#active-session-management)
3. [Security Audit Logs](#security-audit-logs)
4. [Security Policies](#security-policies)
5. [API Rate Limiting](#api-rate-limiting)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [User Guide](#user-guide)

---

## Multi-Factor Authentication (2FA)

### Overview

NCRelay implements TOTP-based two-factor authentication compatible with standard authenticator apps like Google Authenticator, Authy, Microsoft Authenticator, and others.

### Features

- **TOTP Algorithm**: Time-based One-Time Password (RFC 6238)
- **QR Code Generation**: Easy mobile app setup
- **Backup Codes**: 10 emergency backup codes per user
- **Policy Enforcement**: Tenant-level 2FA requirements
- **Graceful Setup**: Users can enable 2FA at any time from their profile

### User Flow

1. **Enable 2FA**:
   - Navigate to Profile → Security Settings
   - Click "Enable Two-Factor Authentication"
   - Scan QR code with authenticator app
   - Enter verification code to confirm setup
   - Save 10 backup codes in a secure location

2. **Login with 2FA**:
   - Enter email and password as usual
   - When prompted, enter 6-digit code from authenticator app
   - Or use one of your backup codes

3. **Disable 2FA**:
   - Navigate to Profile → Security Settings
   - Click "Disable Two-Factor Authentication"
   - Enter current code to confirm

4. **Reset 2FA** (Admin):
   - Administrators can reset 2FA for users who lost access
   - Navigate to Users → Select User → Reset 2FA
   - User must set up 2FA again on next login (if enforced)

### Policy Options

Configured in **Security Center → Policies**:

- **Enforce 2FA for all users**: Requires all users to enable 2FA
- **Require 2FA for administrators only**: Only users with admin roles must use 2FA
- **No enforcement**: 2FA is optional (users can choose to enable)

### Technical Details

```typescript
// 2FA secret generation (base32 encoded)
const secret = speakeasy.generateSecret({
  name: `NCRelay (${user.email})`,
  issuer: 'NCRelay'
});

// QR code generation
const qrCode = await QRCode.toDataURL(secret.otpauth_url);

// Verification
const verified = speakeasy.totp.verify({
  secret: user.twoFactorSecret,
  encoding: 'base32',
  token: userCode,
  window: 2 // Allow 1 minute clock drift
});
```

**Database Fields**:
- `users.twoFactorEnabled`: Boolean flag
- `users.twoFactorSecret`: Encrypted TOTP secret
- `users.twoFactorBackupCodes`: Encrypted JSON array of backup codes

---

## Active Session Management

### Overview

Track and manage user sessions across multiple devices and locations with detailed device information and geolocation.

### Features

- **Multi-Device Tracking**: View all active sessions across devices
- **Device Information**: Browser, OS, device type (Desktop/Mobile/Tablet)
- **Geolocation**: City, region, country based on IP address
- **Session Revocation**: Terminate individual sessions or all other sessions
- **Current Session Marker**: Clearly identifies your current session
- **Automatic Expiration**: Sessions expire after 7 days or 8 hours of inactivity
- **Dual-Token System**: JWT auth token + separate session tracking token

### Session Information Displayed

For each session, users can see:

- **User**: Name and email (useful for admins viewing all sessions)
- **Tenant**: Associated tenant or "System Admin"
- **Device**: Browser and operating system
- **Device Type**: Desktop, Mobile, or Tablet with icon
- **IP Address**: Connection IP
- **Location**: Geographic location (City, Region, Country) or "Local Network" for private IPs
- **Last Active**: Relative time since last activity
- **Created**: Session creation date/time
- **Current Badge**: Indicates your current session

### User Actions

1. **View Active Sessions**:
   - Navigate to **Security Center → Active Sessions**
   - See all sessions with full details

2. **Revoke a Session**:
   - Click the trash icon next to any non-current session
   - Confirm revocation
   - User will be logged out on that device

3. **Revoke All Other Sessions**:
   - Click "Revoke All Other Sessions" button
   - Confirm action
   - All sessions except your current one will be terminated
   - Useful after password change or if suspicious activity detected

### Technical Implementation

**Session Creation Flow**:
1. User logs in with valid credentials (and 2FA if required)
2. JWT auth token is created and set as `ncrelay-auth-token` cookie
3. Session record is created in `user_sessions` table
4. Session token is generated and set as `session-token` cookie
5. IP address, user-agent, and device info are recorded

**Session Validation**:
- Every request validates JWT token
- Session activity timestamp is updated on each request
- Expired sessions are automatically cleaned up

**Geolocation**:
- Uses ipapi.co free API (1000 requests/day)
- 3-second timeout to prevent blocking
- Graceful fallback to "Local Network" for localhost/private IPs
- Parallel geolocation lookups for performance

```typescript
// Session structure
interface UserSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tenantId: string | null;
  tenantName: string | null;
  sessionToken: string;
  ipAddress: string | null;
  location: string | null; // "City, Region, Country"
  userAgent: string | null;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  } | null;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}
```

**Database Tables**:
- `user_sessions`: Session records with tokens, IP, user-agent, device info
- Indexes on: `userId`, `sessionToken`, `expiresAt`

---

## Security Audit Logs

### Overview

Comprehensive audit trail of all security-related events for compliance, troubleshooting, and security monitoring.

### Tracked Events

**Authentication Events**:
- User login (successful and failed attempts)
- User logout
- Password changes
- Password reset requests and completions
- Account lockouts and unlocks

**Two-Factor Authentication Events**:
- 2FA enabled
- 2FA disabled
- 2FA verification (successful and failed)
- Backup code used
- 2FA reset by administrator

**Session Events**:
- Session created
- Session revoked (individual and bulk)
- Session expired

**Security Policy Events**:
- Security policy changes
- Rate limit policy updates
- Password policy modifications
- 2FA enforcement changes

### Audit Log Information

Each audit log entry contains:

- **Event Type**: Specific security event (e.g., "login_success", "2fa_enabled")
- **User**: Who performed the action
- **Tenant**: Associated tenant context
- **Timestamp**: When the event occurred
- **IP Address**: Source IP address
- **Location**: Geographic location (if available)
- **User Agent**: Browser and device information
- **Details**: Additional context (JSON object)
- **Result**: Success or failure
- **Reason**: Failure reason if applicable

### Viewing Audit Logs

1. Navigate to **Security Center → Audit Logs**
2. Filter by:
   - Date range
   - Event type
   - User
   - Tenant
   - Result (success/failure)
3. Search by keywords
4. Export logs for analysis

### Technical Implementation

```typescript
// Audit log entry structure
interface SecurityAuditLog {
  id: string;
  timestamp: string;
  userId: string | null;
  tenantId: string | null;
  eventType: string; // 'login_success', '2fa_enabled', etc.
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, any>;
  result: 'success' | 'failure';
  reason: string | null;
}

// Example: Logging a 2FA enable event
await logSecurityEvent('2fa_enabled', {
  userId: user.id,
  tenantId: user.tenantId,
  details: { backupCodesGenerated: 10 },
  ipAddress: request.ip,
  userAgent: request.headers['user-agent']
});
```

**Database Table**: `security_audit_logs`

---

## Security Policies

### Overview

Tenant-level security policy configuration for password requirements, 2FA enforcement, session management, and account lockout.

### Policy Categories

#### 1. Password Requirements

Configurable password complexity rules:

- **Minimum Length**: 6-32 characters
- **Require Uppercase Letters**: A-Z
- **Require Lowercase Letters**: a-z
- **Require Numbers**: 0-9
- **Require Symbols**: !@#$%^&*()_+-=[]{}|;:,.<>?

**Default Policy**:
- Minimum length: 8 characters
- All complexity requirements: disabled (flexible for development)

**Recommended Production Policy**:
- Minimum length: 12 characters
- Require uppercase: enabled
- Require lowercase: enabled
- Require numbers: enabled
- Require symbols: enabled

#### 2. Two-Factor Authentication

Control 2FA requirements for your tenant:

- **Enforce 2FA for all users**: Every user must enable 2FA to access the system
- **Require 2FA for administrators**: Only users with admin roles must use 2FA
- **No enforcement**: 2FA is optional (users can enable if they choose)

**Note**: If "Enforce for all users" is enabled, the "administrators only" option is automatically disabled since it's redundant.

#### 3. Session & Lockout

Control session behavior and failed login handling:

**Session Timeout**:
- Range: 5 minutes to 7 days (10,080 minutes)
- Default: 480 minutes (8 hours)
- Sessions automatically expire after inactivity timeout

**Failed Login Attempts**:
- Range: 3-20 attempts
- Default: 5 attempts
- After exceeding limit, account is locked

**Lockout Duration**:
- Range: 5 minutes to 24 hours (1,440 minutes)
- Default: 15 minutes
- Account automatically unlocks after duration
- Administrators can manually unlock accounts

### Configuration

1. Navigate to **Security Center → Policies**
2. Configure each policy section
3. Click **Save Changes**
4. Policies take effect immediately for new sessions/actions

### Technical Implementation

```typescript
interface SecuritySettings {
  tenantId: string;
  // Password policies
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  // 2FA policies
  enforce2FA: boolean;
  require2FAForAdmins: boolean;
  // Session & lockout
  sessionTimeoutMinutes: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  // Rate limiting
  rateLimitEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  rateLimitIpWhitelist: string[];
}
```

**Database Table**: `tenant_security_settings`

---

## API Rate Limiting

### Overview

Protect your API endpoints from abuse and DDoS attacks with configurable rate limiting per tenant.

### Features

- **Configurable Limits**: Set maximum requests per time window
- **Time Windows**: Define rate limit windows in seconds (1 second to 1 hour)
- **IP Whitelist**: Exempt trusted IP addresses from rate limiting
- **Per-Tenant Policies**: Each tenant can have different rate limits
- **Graceful Responses**: Returns 429 Too Many Requests with Retry-After header

### Configuration

Navigate to **Security Center → Policies → API Rate Limiting**:

1. **Enable API Rate Limiting**: Toggle on/off
2. **Maximum Requests**: Number of requests allowed (1-10,000)
3. **Time Window**: Duration in seconds (1-3,600)
4. **IP Whitelist**: Add trusted IP addresses that bypass rate limiting

**Example Configurations**:

- **Development**: 1000 requests per 60 seconds (disabled by default)
- **Production Light**: 100 requests per 60 seconds
- **Production Heavy**: 1000 requests per 60 seconds
- **Enterprise**: 10,000 requests per 60 seconds with monitoring

### IP Whitelist

Add IP addresses that should bypass rate limiting:

- Internal monitoring systems
- Trusted API consumers
- Load balancer health checks
- Integration test systems

**Format**: One IP address per entry
- IPv4: `192.168.1.100`
- IPv6: `2001:db8::1`
- Localhost: Automatically treated as local network

### Rate Limit Response

When rate limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{
  "error": "Rate limit exceeded",
  "retryAfter": 42
}
```

### Technical Implementation

Rate limiting is implemented using an in-memory sliding window algorithm:

```typescript
// Check rate limit
const rateLimit = await checkRateLimit({
  tenantId: tenant.id,
  ipAddress: request.ip,
  endpoint: request.url
});

if (!rateLimit.allowed) {
  return res.status(429).json({
    error: 'Rate limit exceeded',
    retryAfter: rateLimit.retryAfter
  });
}
```

**Stored in**: `tenant_security_settings` table

---

## Database Schema

### Tables

#### user_sessions
```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  tenantId TEXT,
  sessionToken TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  deviceInfo TEXT, -- JSON: { browser, os, device, deviceType }
  lastActivityAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

CREATE INDEX idx_sessions_user ON user_sessions(userId);
CREATE INDEX idx_sessions_token ON user_sessions(sessionToken);
CREATE INDEX idx_sessions_expiry ON user_sessions(expiresAt);
```

#### security_audit_logs
```sql
CREATE TABLE security_audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  userId TEXT,
  tenantId TEXT,
  eventType TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  details TEXT, -- JSON
  result TEXT NOT NULL, -- 'success' or 'failure'
  reason TEXT,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);

CREATE INDEX idx_security_logs_timestamp ON security_audit_logs(timestamp);
CREATE INDEX idx_security_logs_user ON security_audit_logs(userId);
CREATE INDEX idx_security_logs_event ON security_audit_logs(eventType);
```

#### tenant_security_settings
```sql
CREATE TABLE tenant_security_settings (
  tenantId TEXT PRIMARY KEY,
  enforce2FA INTEGER DEFAULT 0,
  require2FAForAdmins INTEGER DEFAULT 0,
  passwordMinLength INTEGER DEFAULT 8,
  passwordRequireUppercase INTEGER DEFAULT 0,
  passwordRequireLowercase INTEGER DEFAULT 0,
  passwordRequireNumbers INTEGER DEFAULT 0,
  passwordRequireSymbols INTEGER DEFAULT 0,
  sessionTimeoutMinutes INTEGER DEFAULT 480,
  maxFailedLoginAttempts INTEGER DEFAULT 5,
  lockoutDurationMinutes INTEGER DEFAULT 15,
  rateLimitEnabled INTEGER DEFAULT 0,
  rateLimitMaxRequests INTEGER DEFAULT 100,
  rateLimitWindowMs INTEGER DEFAULT 60000,
  rateLimitIpWhitelist TEXT, -- JSON array
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (tenantId) REFERENCES tenants(id)
);
```

#### users (2FA fields)
```sql
ALTER TABLE users ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN twoFactorSecret TEXT;
ALTER TABLE users ADD COLUMN twoFactorBackupCodes TEXT; -- JSON array
```

---

## API Endpoints

### Authentication & 2FA

- `GET /api/auth/me` - Get current user info
- `POST /api/auth/login` - Login (redirects to 2FA if enabled)
- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/logout` - Logout and revoke session

### 2FA Management

- `POST /api/auth/2fa/setup` - Generate 2FA secret and QR code
- `POST /api/auth/2fa/enable` - Enable 2FA with verification
- `POST /api/auth/2fa/disable` - Disable 2FA
- `POST /api/auth/2fa/verify-backup` - Verify backup code

### Session Management

- `GET /api/auth/sessions` - Get all active sessions
- `DELETE /api/auth/sessions?sessionId={id}` - Revoke specific session
- `DELETE /api/auth/sessions?revokeOthers=true` - Revoke all other sessions

### Security Policies

- `GET /api/tenants/{id}/security` - Get tenant security settings
- `PUT /api/tenants/{id}/security` - Update security settings

### Audit Logs

- `GET /api/audit-logs` - Get security audit logs (with filters)

---

## User Guide

### For End Users

#### Setting Up 2FA

1. Log into NCRelay
2. Click your profile icon → Profile
3. Navigate to Security Settings
4. Click "Enable Two-Factor Authentication"
5. Scan the QR code with your authenticator app:
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
   - 1Password
   - Any TOTP-compatible app
6. Enter the 6-digit code to verify
7. **Save your 10 backup codes** in a secure location
8. Click "Enable"

#### Using Backup Codes

If you lose access to your authenticator app:

1. On the 2FA login screen, click "Use backup code"
2. Enter one of your 10 backup codes
3. The code will be consumed (each code works once)
4. Set up 2FA again or contact an administrator

#### Managing Sessions

1. Navigate to Security Center → Active Sessions
2. View all your active sessions
3. To revoke a session:
   - Click the trash icon next to the session
   - Confirm the action
4. To revoke all sessions except current:
   - Click "Revoke All Other Sessions"
   - Useful after password change or suspicious activity

### For Administrators

#### Enforcing 2FA

1. Navigate to Security Center → Policies
2. Under "Two-Factor Authentication":
   - Enable "Enforce 2FA for all users" OR
   - Enable "Require 2FA for administrators"
3. Click "Save Changes"
4. Users without 2FA will be required to set it up on next login

#### Configuring Security Policies

1. Navigate to Security Center → Policies
2. Configure each section as needed:
   - Password Requirements
   - 2FA Enforcement
   - Session Timeout
   - Account Lockout
   - Rate Limiting
3. Click "Save Changes"
4. Changes take effect immediately

#### Viewing Audit Logs

1. Navigate to Security Center → Audit Logs
2. Use filters to find specific events:
   - Event Type (login, 2FA, password change, etc.)
   - Date Range
   - User
   - Result (success/failure)
3. Review suspicious activity
4. Export logs for compliance or analysis

#### Resetting User 2FA

If a user loses access to their authenticator:

1. Navigate to Users
2. Find the user
3. Click "Reset 2FA"
4. User's 2FA will be disabled
5. User must set up 2FA again on next login (if enforced)

---

## Security Best Practices

### For Production Deployments

1. **Enforce Strong Passwords**:
   - Minimum 12 characters
   - Require all complexity options
   - Educate users on password managers

2. **Require 2FA**:
   - Enable "Enforce 2FA for all users" or at minimum "Require for administrators"
   - Provide clear setup instructions
   - Have backup code recovery process

3. **Configure Session Timeouts**:
   - Use shorter timeouts for sensitive environments (1-4 hours)
   - Balance security with user experience
   - Consider tenant-specific requirements

4. **Set Up Account Lockout**:
   - Use 5 failed attempts with 15-minute lockout
   - Monitor lockout events in audit logs
   - Have manual unlock process for legitimate users

5. **Enable Rate Limiting**:
   - Start with 100 requests/minute
   - Whitelist trusted IPs (monitoring, CI/CD)
   - Monitor rate limit events
   - Adjust based on legitimate traffic patterns

6. **Monitor Audit Logs**:
   - Review daily for suspicious activity
   - Set up alerts for:
     - Multiple failed logins
     - 2FA failures
     - Session anomalies
     - Policy changes
   - Export logs regularly for compliance

7. **Session Management**:
   - Educate users about active sessions
   - Encourage users to revoke unknown sessions
   - Revoke all sessions after security incidents
   - Monitor session creation from unusual locations

### For Multi-Tenant Environments

1. **Per-Tenant Policies**: Allow tenants to configure their own security requirements
2. **Tenant Isolation**: Ensure audit logs and sessions are properly isolated
3. **System Admin Oversight**: System admins can view and manage tenant security
4. **Compliance Support**: Different tenants may have different compliance needs

---

## Troubleshooting

### 2FA Issues

**Problem**: Lost access to authenticator app  
**Solution**: Use backup codes or contact administrator for 2FA reset

**Problem**: "Invalid code" when setting up 2FA  
**Solution**: Ensure device time is synchronized (TOTP requires accurate time)

**Problem**: Backup codes not working  
**Solution**: Each code only works once. Contact administrator if all codes used.

### Session Issues

**Problem**: Sessions not appearing  
**Solution**: Check that migrations have been run (migration 024 adds sessionToken)

**Problem**: Location showing as "Local Network" for public IP  
**Solution**: ipapi.co may be unavailable. This is a non-critical feature that fails gracefully.

**Problem**: Session revoked but still logged in  
**Solution**: Clear browser cookies or wait for JWT token to expire (max 7 days)

### Audit Log Issues

**Problem**: Audit logs not appearing  
**Solution**: Ensure security_audit_logs table exists (migration 023)

**Problem**: Missing IP or location data  
**Solution**: May not be available for certain requests. Non-critical data.

### Rate Limiting Issues

**Problem**: Legitimate traffic being rate limited  
**Solution**: Add IP address to whitelist or increase rate limits

**Problem**: Rate limiting not working  
**Solution**: Ensure rateLimitEnabled is set to true in tenant settings

---

## Migration History

- **Migration 021**: Added 2FA fields to users table
- **Migration 022**: Created security_audit_logs table
- **Migration 023**: Created tenant_security_settings table
- **Migration 024**: Added sessionToken column to user_sessions

---

## Future Enhancements

Potential improvements for enterprise environments:

- **SAML/SSO Integration**: Enterprise single sign-on
- **Hardware Security Keys**: WebAuthn/FIDO2 support
- **Audit Log Export**: Automated export to SIEM systems
- **Advanced Rate Limiting**: Per-endpoint and per-user limits
- **Anomaly Detection**: ML-based suspicious activity detection
- **Compliance Reports**: SOC2, HIPAA, GDPR compliance reporting

See [EXPANSION-FEATURES.md](../Future/EXPANSION-FEATURES.md) for full details.

---

**Document Version**: 1.0  
**Last Updated**: November 22, 2025  
**Status**: ✅ All features implemented and documented
