# NCRelay - Versioning and Deployment Guide

## Branching Strategy

This project uses the following branching strategy for version management:

### Branch Structure

- `dev` - Main development branch, contains the latest changes
- `release/*` - Release branches (e.g., `release/1.2.0`) for stabilizing releases
- `hotfix/*` - Quick fixes for production issues (e.g., `hotfix/1.2.1`)

There is no `main` branch in this project - the `dev` branch serves as the primary development branch.

### Versioning

We follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes

## Automated Docker Image Builds

Our GitHub Actions workflow automatically builds and publishes Docker images based on the branch or tag:

### Branch Builds

- Push to `dev` branch → 
  - `ghcr.io/fraziersystems/ncrelay:dev`
  - `ghcr.io/fraziersystems/ncrelay:latest`
  - `ghcr.io/fraziersystems/ncrelay:1.0.0` (matches package.json version)

- Push to `release/1.2.0` branch → 
  - `ghcr.io/fraziersystems/ncrelay:1.2.0`
  - `ghcr.io/fraziersystems/ncrelay:release-1.2.0`

- Push to `hotfix/1.1.1` branch →
  - `ghcr.io/fraziersystems/ncrelay:1.1.1`
  - `ghcr.io/fraziersystems/ncrelay:hotfix-1.1.1`

### Tag Builds

- Push tag `v1.2.3` → 
  - `ghcr.io/fraziersystems/ncrelay:1.2.3`
  - `ghcr.io/fraziersystems/ncrelay:1.2`

## Development Workflow

### Starting a new feature

```bash
# Start from dev branch
git checkout dev
git pull
git checkout -b feature/my-new-feature

# Work on feature...
git commit -m "Add new functionality"

# Push feature branch
git push origin feature/my-new-feature

# Create PR to dev branch
```

### Creating a release

```bash
# Create release branch from dev
git checkout dev
git pull
git checkout -b release/1.2.0

# Make any final adjustments
# Update version in package.json
git commit -m "Prepare v1.2.0 release"
git push origin release/1.2.0

# This will trigger the build of release Docker images
```

### Publishing a release

After testing the release branch:

```bash
# Tag the release
git checkout release/1.2.0
git pull
git tag -a v1.2.0 -m "Version 1.2.0"
git push origin v1.2.0

# This will trigger the build of versioned Docker images
```

### Hotfix workflow

```bash
# Create hotfix branch from the latest release or tag
git checkout release/1.2.0
git pull
git checkout -b hotfix/1.2.1

# Fix the issue
# Update version in package.json to 1.2.1
git commit -m "Fix critical issue"
git push origin hotfix/1.2.1

# Create PR to dev
```

## Using Versioned Images

Reference a specific version in your docker-compose.yml:

```yaml
services:
  ncrelay:
    image: ghcr.io/fraziersystems/ncrelay:1.2.3
    # ...
```

Or use a floating tag to always get the latest minor version:

```yaml
services:
  ncrelay:
    image: ghcr.io/fraziersystems/ncrelay:1.2
    # ...
```

For development and testing purposes, you can use the latest development version:

```yaml
services:
  ncrelay:
    image: ghcr.io/fraziersystems/ncrelay:dev
    # ...
```
