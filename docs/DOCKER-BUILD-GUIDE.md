# 🚀 Quick Start - Preventing Docker Build Failures

## TL;DR - Run Before Every Docker Build

```bash
npm run validate      # Fast check (30 seconds)
npm run test:docker   # Full test (2-3 minutes)
```

If both pass ✅, your Docker build will succeed!

## Daily Workflow

### 1. During Development
```bash
npm run dev
# Code as normal...
```

### 2. Before Committing
```bash
npm run validate
git add .
git commit -m "Your message"
```

### 3. Before Docker Build
```bash
npm run test:docker
docker compose up --build -d
```

## Available Commands

| Command | Speed | What It Does | When To Use |
|---------|-------|--------------|-------------|
| `npm run validate` | 30s | TypeScript + Import checks | Before commit |
| `npm run test:docker` | 2-3min | Full build simulation | Before Docker build |
| `npm run typecheck` | 20s | TypeScript only | Quick check |
| `npm run setup:hooks` | 1s | Install git hooks | One-time setup |

## One-Time Setup (Optional but Recommended)

Install automatic validation on every commit:

```bash
npm run setup:hooks
```

Now every commit will be validated automatically!

## Common Issues

### "Missing import" Error
**Fix:** Add the missing import at the top of the file
```typescript
import { History, Shield } from "lucide-react";
```

### "TypeScript compilation failed"
**Fix:** Look at the error message, fix the type error
```bash
npm run typecheck  # See all errors
```

### Docker build still fails after validation passes
**Fix:** Clear Docker cache
```bash
docker compose build --no-cache
```

## Full Documentation

See [docs/Documentation/docker-build-validation.md](docs/Documentation/docker-build-validation.md) for complete guide.

## Success Indicators

✅ **Validation passed** = Safe to commit
✅ **Docker test passed** = Safe to build Docker image
✅ **Both passed** = You're good to go!

## Need Help?

1. Run `npm run validate` to see what's wrong
2. Fix the reported issues
3. Run again until it passes
4. Then run `npm run test:docker`
5. If that passes, build Docker image

That's it! 🎉
