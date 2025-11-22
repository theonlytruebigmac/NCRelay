# NCRelay Development Guide

This guide provides comprehensive documentation for developers working on the NCRelay codebase. It covers project setup, architecture, and best practices for development.

## Table of Contents

- [Project Overview](#project-overview)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Database](#database)
- [Authentication](#authentication)
- [API Architecture](#api-architecture)
- [Frontend Components](#frontend-components)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing Guidelines](#contributing-guidelines)

## Project Overview

NCRelay is a notification relay service built with Next.js 15 and SQLite. It allows users to create custom API endpoints that receive XML data and forward it to various messaging platforms like Slack, Discord, and Microsoft Teams.

### Key Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite (via better-sqlite3)
- **Authentication**: Custom authentication with bcrypt
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **Form Handling**: React Hook Form
- **Validation**: Zod

## Development Environment Setup

### Prerequisites

- Node.js v18.0.0 or later
- npm v8.0.0 or later

### Initial Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ncrelay
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file:
   ```env
   NODE_ENV=development
   INITIAL_ADMIN_EMAIL=dev@example.com
   INITIAL_ADMIN_PASSWORD=devpassword
   INITIAL_ADMIN_NAME="Developer User"
   ENCRYPTION_KEY=your-32-character-encryption-key-here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Access the application at http://localhost:3000 (or the configured port in `.env.local`)

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm start` - Start the production server
- `npm run migrate` - Run database migrations
- `npm run create-migration "Description"` - Create a new migration file

## Project Structure

```
ncrelay/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (app)/              # Protected dashboard routes
│   │   ├── (auth)/             # Authentication routes
│   │   ├── api/                # API routes
│   │   └── globals.css         # Global CSS
│   ├── components/             # React components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   ├── layout/             # Layout components
│   │   └── ui/                 # Reusable UI components
│   ├── context/                # React contexts
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility functions and services
│   │   ├── crypto.ts           # Encryption/decryption utilities
│   │   ├── db.ts               # Database interface
│   │   ├── types.ts            # TypeScript type definitions
│   │   └── utils.ts            # General utilities
│   └── migrations/             # Database migrations
│       ├── index.ts            # Migration runner
│       ├── migration-template.ts  # Template for new migrations
│       └── ###-description.ts  # Individual migrations
├── scripts/                    # Utility scripts
│   └── create-migration.ts     # Migration generator
├── public/                     # Static assets
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── next.config.ts              # Next.js configuration
```

## Database

NCRelay uses SQLite with better-sqlite3, which provides a lightweight, embedded database solution. The database file is located at:

- Development: `app.db` in project root
- Production: `/data/app.db`

### Migration System

We use a custom migration system for database schema management:

1. **Migration Files**: Located in `src/migrations/`
2. **Migration Format**:
   ```typescript
   export default {
     name: 'migration-name',
     up: (db: Database.Database): void => {
       // Migration SQL statements
     }
   };
   ```
3. **Creating Migrations**:
   ```bash
   npm run create-migration "Add user preferences"
   ```
   This creates a new migration file with the next sequential number.

4. **Running Migrations**:
   ```bash
   npm run migrate
   ```
   This applies pending migrations.

5. **Migration Tracking**: Applied migrations are stored in the `migrations` table.

### Database Schema

The database includes the following tables:

1. **users** - User accounts and authentication
   ```sql
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT,
     hashedPassword TEXT NOT NULL,
     isAdmin INTEGER DEFAULT 0,
     createdAt TEXT NOT NULL,
     updatedAt TEXT NOT NULL
   );
   ```

2. **password_reset_tokens** - Token storage for password reset functionality
   ```sql
   CREATE TABLE password_reset_tokens (
     id TEXT PRIMARY KEY,
     userId TEXT NOT NULL,
     token TEXT NOT NULL UNIQUE,
     expiresAt TEXT NOT NULL,
     FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
   );
   ```

3. **integrations** - Messaging platform webhook configurations
   ```sql
   CREATE TABLE integrations (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     platform TEXT NOT NULL,
     webhookUrl TEXT NOT NULL, -- Encrypted
     enabled INTEGER NOT NULL,
     targetFormat TEXT NOT NULL,
     createdAt TEXT,
     userId TEXT
   );
   ```

4. **api_endpoints** - Custom API endpoint definitions
   ```sql
   CREATE TABLE api_endpoints (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     path TEXT NOT NULL UNIQUE,
     associatedIntegrationIds TEXT NOT NULL, -- JSON string array
     createdAt TEXT NOT NULL,
     description TEXT, -- Added in migration 002
     ipWhitelist TEXT DEFAULT '[]' -- Added in migration 008, JSON array of allowed IPs
   );
   ```

5. **request_logs** - API request and relay attempt logs
   ```sql
   CREATE TABLE request_logs (
     id TEXT PRIMARY KEY,
     timestamp TEXT NOT NULL,
     apiEndpointId TEXT,
     apiEndpointName TEXT,
     apiEndpointPath TEXT NOT NULL,
     incomingRequestIp TEXT,
     incomingRequestMethod TEXT NOT NULL,
     incomingRequestHeaders TEXT NOT NULL, -- Encrypted
     incomingRequestBodyRaw TEXT NOT NULL, -- Encrypted
     processingOverallStatus TEXT NOT NULL,
     processingMessage TEXT NOT NULL,
     integrationAttempts TEXT -- Encrypted JSON string array
   );
   ```

6. **smtp_settings** - Email server configuration
   ```sql
   CREATE TABLE smtp_settings (
     id TEXT PRIMARY KEY,
     host TEXT NOT NULL,
     port INTEGER NOT NULL,
     user TEXT NOT NULL,
     password TEXT NOT NULL, -- Encrypted
     secure INTEGER NOT NULL,
     fromEmail TEXT NOT NULL,
     appBaseUrl TEXT NOT NULL
   );
   ```

7. **migrations** - Database migration tracking
   ```sql
   CREATE TABLE migrations (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     applied_at TEXT NOT NULL
   );
   ```

### Database Operations

Database operations are implemented in `src/lib/db.ts`, which provides a set of typed functions for CRUD operations on each entity.

## Authentication

NCRelay uses a custom authentication system built with Next.js Server Actions:

1. **User Model**: Defined in `src/lib/types.ts`
2. **Auth Context**: Provides user state and auth methods via `useAuth()` hook
3. **Password Storage**: Passwords are hashed using bcrypt
4. **Session Management**: Uses HTTP-only cookies

### Auth Workflow

1. User submits login form
2. Server validates credentials and sets HTTP-only cookie
3. Protected routes check for valid session
4. Auth context provides user state to components

## API Architecture

NCRelay API is built with Next.js API routes in the App Router:

1. **Custom API Endpoints**: `/api/custom/{uuid}` receives XML data and triggers integrations
2. **Protected API Routes**: Require authentication for admin operations
3. **Server Actions**: Used for form submissions and CRUD operations

### Request Processing Flow

1. **Receipt**: XML data is received at a custom endpoint
2. **IP Validation**: Client IP is checked against endpoint's whitelist (if configured)
3. **Processing**: Data is parsed and validated
4. **Transformation**: Converted to the target format (JSON, text, XML)
5. **Relay**: Sent to configured webhooks
6. **Logging**: Request details and results are logged

### Security Features

1. **IP Address Whitelisting**: Endpoints can restrict access to specific IP addresses
2. **Secure UUID Paths**: Endpoints use random UUIDs to prevent enumeration attacks
3. **Data Encryption**: Sensitive data like webhook URLs are encrypted at rest
4. **Authentication**: Protected routes require user authentication

## Frontend Components

The UI is built with React components styled with Tailwind CSS:

1. **Layout**: Page shell, sidebar, and navigation
2. **Forms**: Integration, API endpoint, and settings forms
3. **Cards**: Display integration and endpoint information
4. **Tables**: List logs and other data
5. **Dialogs**: Confirmation and detail views

### Component Organization

- **UI Components**: Reusable UI elements in `src/components/ui/`
  - `ip-whitelist-manager.tsx`: Component for managing IP address whitelists
  - Form components, buttons, dialogs, and other UI primitives
- **Layout Components**: Structural components in `src/components/layout/`
- **Feature Components**: Feature-specific components in `src/components/dashboard/`

### Styling

- **Tailwind CSS**: Used for styling with utility classes
- **Global Styles**: Defined in `src/app/globals.css`
- **Theme**: Color scheme defined in tailwind.config.ts

## Testing

> Note: Comprehensive testing is planned for future development.

### Recommended Testing Approach

1. **Unit Tests**:
   - Use Jest for testing utility functions
   - Test individual components with React Testing Library

2. **Integration Tests**:
   - Test database operations
   - Test API endpoints

3. **E2E Tests**:
   - Use Cypress or Playwright for end-to-end tests
   - Test critical user flows

## Deployment

### Docker Deployment

1. **Build the Docker Image**:
   ```bash
   docker build -t ncrelay .
   ```

2. **Run the Container**:
   ```bash
   docker run -p 3000:3000 -v /path/to/data:/data \
     -e NODE_ENV=production \
     -e ENCRYPTION_KEY=your-key \
     -e INITIAL_ADMIN_EMAIL=admin@example.com \
     -e INITIAL_ADMIN_PASSWORD=secure-password \
     ncrelay
   ```

### Environment Configuration

For production deployment, set these environment variables:

- `NODE_ENV=production` - Enable production mode
- `ENCRYPTION_KEY` - Used for encrypting sensitive data
- `INITIAL_ADMIN_EMAIL` - Admin email for first login
- `INITIAL_ADMIN_PASSWORD` - Admin password for first login

## Contributing Guidelines

### Code Style

- Use TypeScript features for type safety
- Follow ESLint configurations
- Use functional React components with hooks
- Use comments for complex logic

### Git Workflow

We follow a specific branching strategy:

1. **Development Branch**: The `dev` branch is our main development branch
   ```bash
   git checkout dev
   git pull
   ```

2. **Feature Branches**: Create a branch from `dev` for each feature or fix
   ```bash
   git checkout -b feature/feature-name
   ```

3. **Release Branches**: Create from `dev` when preparing a release
   ```bash
   git checkout -b release/1.2.0
   ```
   
4. **Hotfix Branches**: Create from the latest release when fixing critical issues
   ```bash
   git checkout -b hotfix/1.1.1
   ```

5. **Commit Style**: Use clear, descriptive commit messages
   ```bash
   git commit -m "Add feature: description"
   ```

6. **Pull Requests**: Create PRs to the appropriate branch with a description of changes

For more details on our branching and versioning strategy, see [VERSIONING.md](./VERSIONING.md).

### Adding a New Feature

1. **Plan**: Define the feature requirements
2. **Database**: Create migrations for schema changes if needed
3. **API**: Implement API endpoints or Server Actions
4. **UI**: Create necessary UI components
5. **Testing**: Add tests for the feature
6. **Documentation**: Update documentation

## Database Migration Workflow

Migrations are a critical part of NCRelay's development process. Here's a detailed workflow:

### Creating a Migration

1. **Generate Migration File**:
   ```bash
   npm run create-migration "Add user roles"
   ```

2. **Edit Migration File**: Implement the `up` function with SQL statements
   ```typescript
   up: (db: Database.Database): void => {
     db.exec(`
       ALTER TABLE users
       ADD COLUMN role TEXT DEFAULT 'user';
     `);
   }
   ```

3. **Run the Migration**:
   ```bash
   npm run migrate
   ```

4. **Update Type Definitions**: If the migration changes the schema, update related types in `src/lib/types.ts`

### Migration Best Practices

- **Single Responsibility**: Each migration should do one thing
- **Idempotency**: Migrations should be idempotent where possible (use `IF NOT EXISTS`)
- **Data Migrations**: Handle data transformations carefully
- **Documentation**: Add comments explaining complex migrations

## Troubleshooting

### Common Issues

1. **Database Errors**:
   - Ensure migrations run successfully
   - Check database file permissions
   - Verify schema with `sqlite3 app.db .schema`

2. **API Errors**:
   - Check API request format
   - Verify API endpoint exists
   - Inspect request logs

3. **Authentication Issues**:
   - Clear browser cookies
   - Verify user credentials in database
   - Check authentication flow in the browser console

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

This development guide is a living document that will evolve as NCRelay continues to grow. Developers are encouraged to contribute improvements to this documentation.
