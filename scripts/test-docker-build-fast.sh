#!/bin/bash

# Fast Docker Build Test Script
# Tests Docker build without actually building the full image
# This simulates the build environment to catch issues early

set -e

echo "🐳 Docker Build Test (Fast Mode)"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Step 1: Simulate Docker build environment
print_info "Simulating Docker production build environment..."

# Set production environment variables
export NODE_ENV=production
export JWT_SECRET=build-time-dummy-secret-32chars-minimum

# Step 2: Run the exact build command from Dockerfile
print_info "Running production build..."
if npm run build; then
    print_status 0 "Production build successful"
else
    print_status 1 "Production build failed"
    exit 1
fi

# Step 3: Check if migration imports need fixing
print_info "Checking migration imports..."
if [ -f "scripts/fix-migration-imports.js" ]; then
    if node scripts/fix-migration-imports.js; then
        print_status 0 "Migration imports fixed"
    else
        print_status 1 "Migration import fixing failed"
        exit 1
    fi
fi

# Step 4: Compile server TypeScript
print_info "Compiling server TypeScript..."
if npx tsc --project tsconfig.server.json; then
    print_status 0 "Server compilation successful"
else
    print_status 1 "Server compilation failed"
    exit 1
fi

# Step 5: Fix lib imports
print_info "Fixing lib imports..."
if [ -f "scripts/fix-lib-imports.js" ]; then
    if node scripts/fix-lib-imports.js; then
        print_status 0 "Lib imports fixed"
    else
        print_status 1 "Lib import fixing failed"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✓ Docker build test passed!${NC}"
echo -e "${GREEN}  Safe to run 'docker compose up --build'${NC}"
echo ""
echo "To build the actual Docker image, run:"
echo "  docker compose up --build -d"
