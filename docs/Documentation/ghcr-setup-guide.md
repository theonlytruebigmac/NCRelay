# GitHub Container Registry Setup

## Permissions Required for GitHub Actions

To allow GitHub Actions to push Docker images to GitHub Container Registry (ghcr.io), you need to configure the proper permissions.

### Option 1: Using the Default GITHUB_TOKEN (Recommended)

1. Go to your repository on GitHub
2. Click on "Settings" > "Actions" > "General"
3. Scroll down to "Workflow permissions"
4. Select "Read and write permissions"
5. Check "Allow GitHub Actions to create and approve pull requests"
6. Click "Save"

### Option 2: Using a Personal Access Token (PAT)

If you need more specific permissions or are working with an organization:

1. Go to your GitHub account settings
2. Click on "Developer settings" > "Personal access tokens" > "Tokens (classic)"
3. Click "Generate new token" > "Generate new token (classic)"
4. Give the token a descriptive name
5. Select these permissions:
   - `repo` (all)
   - `write:packages`
   - `read:packages`
   - `delete:packages` (if you need to delete packages)
6. Click "Generate token" and copy the token
7. In your repository, go to "Settings" > "Secrets and variables" > "Actions"
8. Create a new repository secret named `CR_PAT` with the value of your token
9. Update the GitHub workflow file to use this token:

```yaml
- name: Login to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.repository_owner }}
    password: ${{ secrets.CR_PAT }}
```

## Making Packages Public

By default, packages pushed to ghcr.io are private. To make them public:

1. Go to your GitHub profile
2. Click on "Packages"
3. Select your package
4. On the right side, click the settings icon (gear)
5. Scroll down to "Danger Zone"
6. Click "Change visibility"
7. Select "Public" and confirm

## Package Organization Access

If you're pushing to an organization's package, ensure:

1. The organization allows publishing packages
2. Your account has the write permissions to the organization's packages
3. The repository has access to publish packages

To check organization settings:
1. Go to the organization page
2. Click "Settings" > "Packages"
3. Review the permissions settings

## NCRelay Image Naming and Tagging Conventions

Our GitHub Actions workflow (`build-docker-image.yml`) automatically builds and publishes Docker images based on branches and tags:

### Branch-Based Images

- `dev` branch builds:
  - `ghcr.io/theonlytruebigmac/ncrelay:dev`
  - `ghcr.io/theonlytruebigmac/ncrelay:latest`
  - `ghcr.io/theonlytruebigmac/ncrelay:1.0.0` (matches package.json version)

- `release/1.2.0` branch builds:
  - `ghcr.io/theonlytruebigmac/ncrelay:1.2.0`
  - `ghcr.io/theonlytruebigmac/ncrelay:release-1.2.0`

- `hotfix/1.1.1` branch builds:
  - `ghcr.io/theonlytruebigmac/ncrelay:1.1.1`
  - `ghcr.io/theonlytruebigmac/ncrelay:hotfix-1.1.1`

### Tag-Based Images

- Version tag `v1.2.3` builds:
  - `ghcr.io/theonlytruebigmac/ncrelay:1.2.3`
  - `ghcr.io/theonlytruebigmac/ncrelay:1.2`

For more details on our branching and versioning strategy, see [VERSIONING.md](./VERSIONING.md).

## Troubleshooting Common Issues

1. **"denied: installation not allowed to Write organization package"**
   - Ensure the workflow has `packages: write` permission
   - Check if your PAT or GitHub token has the proper scopes
   - Verify organization settings for package publishing

2. **"Package creation failed"**
   - Check image name for proper formatting
   - Ensure there are no naming conflicts

3. **"Authentication failed"**
   - Verify token has not expired
   - Check token permissions
   - Ensure username is correct
