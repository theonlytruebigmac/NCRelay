# Docker Build Troubleshooting Guide

## Overview
This guide helps prevent and resolve Docker build failures in NCRelay.

## Quick Start - Before Every Docker Build

### Option 1: Fast Validation (Recommended - 30 seconds)
```bash
npm run validate
```

### Option 2: Full Docker Build Test (2-3 minutes)
```bash
npm run test:docker
```

## Prevention Tools

### 1. Build Validation Script
**Purpose:** Catches TypeScript errors, missing imports, and common issues before building Docker images.

**Usage:**
```bash
npm run validate
# or
./scripts/validate-build.sh
```

**What it checks:**
- ✅ TypeScript compilation (main project, migrations, server)
- ✅ ESLint issues
- ✅ Missing dependencies
- ⚠️ Unused imports
- ⚠️ Console statements
- ⚠️ TODO/FIXME comments

**When to run:**
- Before committing code
- Before building Docker images
- After adding/removing imports
- After major refactoring

### 2. Fast Docker Build Test
**Purpose:** Simulates the Docker build environment locally to catch build issues without actually building the Docker image.

**Usage:**
```bash
npm run test:docker
# or
./scripts/test-docker-build-fast.sh
```

**What it does:**
- Sets production environment variables
- Runs the exact build command from Dockerfile
- Compiles all TypeScript files
- Fixes imports as Docker would
- Reports any issues

**When to run:**
- Before `docker compose up --build`
- After changing build scripts
- When debugging Docker build failures

### 3. Pre-commit Hook (Optional but Recommended)
**Purpose:** Automatically validates code before every commit.

**Installation:**
```bash
npm run setup:hooks
# or manually:
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**What it does:**
- Runs TypeScript check before commit
- Prevents commits with type errors
- Can be bypassed with `--no-verify` if needed

## Common Docker Build Failures

### Problem 1: Missing Import
**Error:**
```
Type error: JSX element class does not support attributes
Type error: Cannot find name 'Something'
```

**Cause:** Missing import statement (e.g., missing icon from lucide-react)

**Prevention:**
```bash
npm run validate  # Will catch missing imports
```

**Fix:**
```typescript
// Add the missing import
import { History, Shield, Settings } from "lucide-react";
```

### Problem 2: TypeScript Compilation Error
**Error:**
```
Failed to compile.
Type error: ...
```

**Cause:** TypeScript errors that work in dev but fail in production build

**Prevention:**
```bash
npm run typecheck  # Check before building
npm run validate   # Comprehensive check
```

**Fix:**
- Fix the reported TypeScript error
- Run validation again to confirm

### Problem 3: Migration Import Issues
**Error:**
```
Error: Cannot find module ...migrations...
```

**Cause:** ES module import issues in migrations

**Prevention:**
```bash
npm run test:docker  # Tests migration compilation
```

**Fix:**
- Ensure migrations use named exports
- Run `node scripts/fix-migration-imports.js`

### Problem 4: Missing Dependencies
**Error:**
```
Cannot find module 'some-package'
```

**Cause:** Dependency in devDependencies instead of dependencies

**Prevention:**
```bash
npm run validate  # Checks node_modules
```

**Fix:**
```bash
npm install some-package --save
# (not --save-dev)
```

## Workflow Integration

### Recommended Daily Workflow

1. **Before starting work:**
   ```bash
   git pull
   npm install  # Update dependencies if needed
   ```

2. **During development:**
   ```bash
   npm run dev  # Develop normally
   ```

3. **Before committing:**
   ```bash
   npm run validate  # Fast check (30s)
   git add .
   git commit -m "Your message"
   ```

4. **Before Docker build:**
   ```bash
   npm run test:docker  # Full simulation (2-3min)
   docker compose up --build -d
   ```

### CI/CD Integration

Add to GitHub Actions / CI pipeline:

```yaml
- name: Validate Build
  run: npm run validate

- name: Test Docker Build
  run: npm run test:docker
```

## Troubleshooting Steps

### When Docker build fails:

1. **Read the error message carefully**
   - Note the file and line number
   - Look for "Type error:", "Cannot find", etc.

2. **Run validation locally:**
   ```bash
   npm run validate
   ```
   
3. **Fix reported issues**
   - Fix imports
   - Fix TypeScript errors
   - Install missing packages

4. **Test the fix:**
   ```bash
   npm run test:docker
   ```

5. **Build Docker image:**
   ```bash
   docker compose up --build -d
   ```

## Quick Reference Commands

```bash
# Install everything (run after git clone or package.json changes)
npm install

# Type checking only (fastest)
npm run typecheck

# Full validation (recommended before commit)
npm run validate

# Simulate Docker build (before docker compose)
npm run test:docker

# ESLint check
npm run lint

# Setup git hooks
npm run setup:hooks

# Build production locally (simulates Docker)
NODE_ENV=production npm run build

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## Package.json Scripts Summary

These scripts are available in your `package.json`:

- `npm run validate` - Run build validation
- `npm run test:docker` - Test Docker build locally
- `npm run typecheck` - TypeScript check only
- `npm run lint` - ESLint check
- `npm run setup:hooks` - Install git hooks

## Best Practices

1. ✅ **Always run `npm run validate` before committing**
2. ✅ **Always run `npm run test:docker` before `docker compose up --build`**
3. ✅ **Install git hooks for automatic validation**
4. ✅ **Keep imports organized and remove unused ones**
5. ✅ **Test in production mode locally before deploying**
6. ✅ **Check TypeScript errors immediately (don't let them accumulate)**

## Getting Help

If validation passes but Docker build still fails:
1. Check Docker logs: `docker compose logs`
2. Verify Node.js version: `node --version` (should be 22.12.0+)
3. Clear build cache: `docker compose build --no-cache`
4. Check disk space: `df -h`

## Automation Level

- **Basic:** Run `npm run validate` manually before commits
- **Intermediate:** Install pre-commit hook + run `npm run test:docker` before Docker builds
- **Advanced:** Add CI/CD pipeline checks + automated Docker builds
