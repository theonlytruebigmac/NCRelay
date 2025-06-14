# Troubleshooting Docker Image Builds

If you encounter issues with Docker image builds in GitHub Actions, here are some common problems and solutions.

## Common Issues and Solutions

### Permission Denied When Pushing to GHCR

#### Common Error: "permission_denied: write_package"

**Error message:**
```
ERROR: failed to push ghcr.io/theonlytruebigmac/ncrelay:1.0.0: denied: permission_denied: write_package
```

**Solutions:**

1. **Check Workflow Permissions:**
   - Ensure your workflow has the proper permissions:
   ```yaml
   permissions:
     contents: read
     packages: write
     id-token: write  # Add this for some authentication scenarios
   ```

2. **Update Repository Settings:**
   - Go to your repository on GitHub
   - Navigate to Settings > Actions > General
   - Scroll to "Workflow permissions"
   - Select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"
   - Save changes

3. **Link Package to Repository (First-Time Push):**
   - If this is your first time pushing this package, you may need to manually link it:
   - Make an initial push attempt (it will fail)
   - Go to your GitHub profile > "Packages"
   - Find the package that was partially created
   - Go to package settings
   - Connect it to your repository
   - Try pushing again

4. **Organization Packages Settings:**
   - Go to your organization settings
   - Navigate to Packages
   - Ensure "Enable improved container support" is checked
   - Under "Package Creation", ensure your repository has access
   - Check that the members pushing have sufficient permissions

5. **Use github.actor Instead of github.repository_owner:**
   - Sometimes using `github.actor` works better for authentication:
   ```yaml
   - name: Login to GitHub Container Registry
     uses: docker/login-action@v3
     with:
       registry: ghcr.io
       username: ${{ github.actor }}
       password: ${{ secrets.GITHUB_TOKEN }}
   ```

6. **Try Using a Personal Access Token:**
   - Create a PAT with the `write:packages` scope
   - Add it to repository secrets as `CR_PAT`
   - Update your workflow:
   ```yaml
   - name: Login to GitHub Container Registry
     uses: docker/login-action@v3
     with:
       registry: ghcr.io
       username: ${{ github.repository_owner }}
       password: ${{ secrets.CR_PAT }}
   ```

### Build Failures

If your Docker build fails:

1. **Review Build Logs:**
   - Check for specific error messages in the workflow logs
   - Look for failed commands or missing dependencies

2. **Test Locally First:**
   ```bash
   docker build -t ncrelay:test .
   ```

3. **Validate Dockerfile:**
   - Check for syntax errors
   - Ensure all referenced files exist
   - Verify base image availability

4. **Check for Resource Limits:**
   - GitHub Actions runners have resource limits
   - Consider optimizing your Dockerfile for smaller image size

### Image Tagging Issues

If your images aren't getting the correct tags:

1. **Check the Workflow Configuration:**
   - Our workflow (`build-docker-image.yml`) extracts the version from package.json
   - Ensure the version in package.json is correctly set
   - Branch names should follow our conventions: `dev`, `release/*`, `hotfix/*`

2. **Expected Tag Patterns:**
   - `dev` branch → `dev`, `latest`, and version from package.json
   - `release/1.2.0` branch → `1.2.0` and `release-1.2.0`
   - `hotfix/1.1.1` branch → `1.1.1` and `hotfix-1.1.1`
   - Version tags `v1.2.3` → `1.2.3` and `1.2`

3. **Debug Steps:**
   - Check the workflow run logs to see what tags were generated
   - Verify the extracted version from package.json
   - Confirm that the branch name follows the expected format

## Testing GHCR Access Locally

To verify your GHCR access locally:

```bash
# Login to GHCR
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# Build and tag a test image
docker build -t ghcr.io/org/repo:test .

# Try pushing
docker push ghcr.io/org/repo:test
```

## Contacting GitHub Support

If you've tried all solutions and still encounter issues:

1. Collect all error messages
2. Document the steps you've already taken
3. Contact GitHub Support through:
   - https://support.github.com/
   - Include your repository and workflow file details
