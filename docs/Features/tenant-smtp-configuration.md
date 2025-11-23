# Tenant-Specific SMTP Configuration Implementation

## Overview
Implemented tenant-specific SMTP configuration allowing each tenant to use their own email server for notifications, while maintaining a global SMTP configuration for system-wide operations (password resets, SaaS metrics, alerts).

## Architecture

### Database Schema
- **Migration 028**: Added `tenantId` column to `smtp_settings` table
  - `tenantId = NULL`: Global/system SMTP configuration
  - `tenantId = <tenant-id>`: Tenant-specific SMTP configuration

### Email Hierarchy
1. **Tenant Notifications**: Use tenant SMTP if configured
2. **Fallback**: Use global SMTP if tenant SMTP not configured
3. **System Operations**: Always use global SMTP (password resets, system alerts)

## Files Modified

### Database Layer (`src/lib/db.ts`)
- **`getSmtpSettings(tenantId?, fallbackToGlobal?)`**
  - Accepts optional `tenantId` parameter
  - If `tenantId` provided: returns tenant-specific settings
  - If `fallbackToGlobal=true`: returns global settings when tenant config not found
  - If `tenantId` is null/undefined: returns global settings

- **`saveSmtpSettings(settings)`**
  - Saves SMTP settings with optional `tenantId`
  - Generates appropriate ID: `smtp_${tenantId}` or `default_settings`

- **`deleteSmtpSettings(tenantId?)`**
  - Deletes tenant-specific or global SMTP settings

### Email Service (`src/lib/email.ts`)
- **`getTransporter(tenantId?, fallbackToGlobal?)`**
  - Creates nodemailer transporter with tenant or global SMTP
  - Supports automatic fallback to global SMTP

- **`sendPasswordResetEmail(to, token)`**
  - Always uses global SMTP (system operation)

- **`sendNotificationFailureEmail(to, details, tenantId?)`**
  - Uses tenant SMTP with fallback to global
  - Added `tenantId` parameter for tenant-scoped emails

- **`sendNotificationDigestEmail(to, period, summary, tenantId?)`**
  - Uses tenant SMTP with fallback to global
  - Added `tenantId` parameter for tenant-scoped emails

### Actions

#### Tenant SMTP Actions (`src/app/(app)/dashboard/settings/smtp/actions.ts`)
- **`getSmtpSettingsAction()`**
  - Gets current tenant ID from cookies
  - Returns tenant-specific SMTP settings (no fallback)

- **`saveSmtpSettingsAction(formData)`**
  - Saves SMTP settings for current tenant
  - Uses `tenantId` from cookies

- **`testSmtpSettingsAction(formData)`**
  - Tests SMTP configuration before saving
  - Works for both tenant and global configs

#### Global SMTP Actions (`src/app/(app)/dashboard/admin/smtp/actions.ts`)
- **`getGlobalSmtpSettingsAction()`**
  - System admin only
  - Returns global SMTP settings (`tenantId = NULL`)

- **`saveGlobalSmtpSettingsAction(formData)`**
  - System admin only
  - Saves global SMTP settings

- **`testGlobalSmtpSettingsAction(formData)`**
  - System admin only
  - Tests global SMTP configuration

### UI Components

#### SMTP Settings Form (`src/components/dashboard/settings/SmtpSettingsForm.tsx`)
- Made actions configurable via props
- Accepts `saveAction` and `testAction` props
- Defaults to tenant actions for backward compatibility
- Can be reused for both tenant and global SMTP pages

#### Tenant SMTP Page (`src/app/(app)/dashboard/settings/smtp/page.tsx`)
- Updated description to clarify tenant-specific configuration
- Explains fallback behavior and system-level operations
- Uses default tenant actions

#### Global SMTP Page (`src/app/(app)/dashboard/admin/smtp/page.tsx`)
- **NEW**: System admin page for global SMTP
- Located at `/dashboard/admin/smtp`
- Includes explanatory alerts about usage:
  - System-wide monitoring alerts
  - SaaS metrics and reports
  - Password reset emails
  - Fallback for unconfigured tenants
- Passes global actions to `SmtpSettingsForm`

### Navigation (`src/config/site.ts`)
- **Tenant Settings** section:
  - "SMTP Config" → `/dashboard/settings/smtp` (tenant-specific)
  
- **Admin Settings** section:
  - "Global SMTP" → `/dashboard/admin/smtp` (system-wide)
  - Renamed from "SMTP Config" to avoid confusion
  - `systemAdminOnly: true` flag

### Types (`src/lib/types.ts`)
- Added optional `tenantId?: string | null` to `SmtpSettings` interface

## Usage Examples

### For Tenant Administrators
1. Navigate to **Dashboard → Settings → SMTP Config**
2. Configure tenant-specific SMTP server
3. Test configuration with test email
4. Save settings
5. All tenant notifications will use this SMTP
6. If not configured, system falls back to global SMTP

### For System Administrators
1. Navigate to **Dashboard → Admin Settings → Global SMTP**
2. Configure system-wide SMTP server
3. Test configuration
4. Save settings
5. Used for:
   - Password resets (all users)
   - System alerts and monitoring
   - SaaS metrics reports
   - Fallback when tenant SMTP not configured

## Email Routing Logic

```typescript
// Notification emails (tenant-scoped)
sendNotificationFailureEmail(to, details, tenantId)
  → Try tenant SMTP
  → Fallback to global SMTP if tenant not configured

// System emails (always global)
sendPasswordResetEmail(to, token)
  → Always use global SMTP
```

## Migration Path

### Existing Installations
1. Run migration 028 to add `tenantId` column
2. Existing `smtp_settings` row will have `tenantId = NULL` (global)
3. No action required - system continues working with global SMTP
4. Tenants can optionally configure their own SMTP

### New Installations
1. System admin configures global SMTP first
2. Tenants can optionally add their own SMTP configurations
3. Each tenant's SMTP is isolated and secure

## Security Considerations

1. **Password Encryption**: SMTP passwords encrypted using `encrypt()`/`decrypt()` from `crypto.ts`
2. **Permission Checks**: 
   - Tenant SMTP: Requires `settings.manage` permission
   - Global SMTP: Requires system admin status (`isAdmin()`)
3. **Tenant Isolation**: Each tenant can only access their own SMTP settings
4. **Audit Logging**: Consider adding audit events for SMTP configuration changes

## Testing

### Test Tenant SMTP
1. As tenant admin, go to Settings → SMTP Config
2. Enter test SMTP server details
3. Click "Send Test Email"
4. Verify test email received

### Test Global SMTP
1. As system admin, go to Admin Settings → Global SMTP
2. Enter production SMTP server details
3. Click "Send Test Email"
4. Verify test email received

### Test Fallback Behavior
1. Configure global SMTP
2. Do NOT configure tenant SMTP for a test tenant
3. Trigger notification from that tenant
4. Verify email sent using global SMTP

## Future Enhancements

1. **Audit Logging**: Add security audit events for SMTP config changes
2. **Rate Limiting**: Per-tenant email sending limits
3. **Email Templates**: Tenant-specific email branding/templates
4. **Delivery Status**: Track email delivery success/failure rates per tenant
5. **Quota Management**: Email sending quotas per tenant tier
6. **SMTP Providers**: Pre-configured templates for common providers (Gmail, SendGrid, etc.)
