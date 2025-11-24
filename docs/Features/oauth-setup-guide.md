# OAuth Setup Guide for NCRelay

This guide will walk you through setting up Google OAuth authentication for NCRelay.

## Overview

NCRelay now supports two authentication methods:
1. **Local Authentication** (Email/Password) - Always available for development
2. **Google OAuth** - Optional, enabled via environment variables

## Prerequisites

- NCRelay instance running with database migrations applied
- Access to Google Cloud Console (for Google OAuth)
- HTTPS-enabled domain (required for production OAuth)

## Environment Variables

Add these to your `.env` file:

```bash
# NextAuth Configuration (Required)
NEXTAUTH_URL=http://localhost:9004  # or your production URL
NEXTAUTH_SECRET=your-super-secret-key-min-32-chars  # Generate with: openssl rand -base64 32

# OAuth Feature Flags (Optional)
NEXT_PUBLIC_OAUTH_ENABLED=true
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true

# Google OAuth (Required if Google is enabled)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Google OAuth Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"

### 2. Configure OAuth Consent Screen

1. Click "Configure Consent Screen"
2. Choose "External" (unless you're using Google Workspace)
3. Fill in the required information:
   - **App name**: NCRelay
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Add the following scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Save and continue

### 3. Create OAuth 2.0 Credentials

1. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
2. Choose "Web application"
3. Set the name: "NCRelay Web Client"
4. Add Authorized JavaScript origins:
   - Development: `http://localhost:9004`
   - Production: `https://yourdomain.com`
5. Add Authorized redirect URIs:
   - Development: `http://localhost:9004/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
6. Click "Create"
7. Copy the **Client ID** and **Client Secret**

### 4. Update Environment Variables

```bash
GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWx
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

## Testing OAuth in Development

### 1. Enable OAuth Features

Update your `.env.local`:

```bash
NEXT_PUBLIC_OAUTH_ENABLED=true
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test Sign In

1. Navigate to `http://localhost:9004/login`
2. You should see "Continue with Google" button (if enabled)
3. Click the button and complete OAuth flow
4. You should be redirected back to the dashboard

### 4. Verify User in Database

```bash
sqlite3 app.db "SELECT id, email, name, provider, providerId FROM users;"
```

You should see your OAuth user with `provider='google'` and a `providerId`.

## Maintaining Local Authentication

**Important**: Local email/password authentication will always work for development, even if OAuth is not configured. This ensures you can:

- Develop and test without OAuth setup
- Always have a fallback authentication method
- Create admin users via environment variables

To keep using local auth:
1. Simply leave OAuth environment variables unset
2. The login form will only show email/password fields
3. Existing users with passwords can still log in

## Security Considerations

### Production Deployment

1. **Always use HTTPS** - OAuth providers require it
2. **Secure NEXTAUTH_SECRET** - Generate a strong random string:
   ```bash
   openssl rand -base64 32
   ```
3. **Update redirect URIs** - Make sure they match your production domain exactly
4. **Restrict domains** - In OAuth provider consoles, only allow your domain
5. **Keep secrets secure** - Never commit secrets to version control

### Account Linking

Currently, the system prevents users from signing in with multiple OAuth providers using the same email. To change this behavior, modify the `signIn` callback in `/src/lib/auth-config.ts`.

## Troubleshooting

### "OAuth provider not configured" error

- Check that environment variables are set correctly
- Restart the development server after adding new env vars
- Verify `NEXT_PUBLIC_OAUTH_ENABLED=true` is set

### Google OAuth redirect mismatch

- Ensure authorized redirect URI in Google Console exactly matches: `http://localhost:9004/api/auth/callback/google`
- Check for trailing slashes
- Verify NEXTAUTH_URL is set correctly

### Users can't sign in after enabling OAuth

- Existing email/password users are unaffected
- Make sure `provider='local'` is set for existing users (migration handles this)
- Check database: `SELECT provider FROM users;`

## Migration Path

If you have existing users and want to enable OAuth:

1. Apply the OAuth migration (already done if you followed setup)
2. Existing users will have `provider='local'`
3. They can continue using email/password
4. New users can sign up with OAuth or email/password
5. Consider adding an "account linking" feature later if needed

## Next Steps

- Set up email verification for OAuth users (future enhancement)
- Add profile picture support from OAuth providers
- Implement account linking to connect multiple auth methods
- Add session management UI to view OAuth connections

## Support

For issues or questions:

- Check the [NCRelay documentation](../README.md)
- Review NextAuth.js documentation: <https://next-auth.js.org/>
- Check Google OAuth documentation: <https://developers.google.com/identity/protocols/oauth2>
