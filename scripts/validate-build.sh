#!/bin/bash

# NCRelay Build Validation Script
# This script validates that the codebase is ready for Docker build
# Run this before committing or building Docker images

set -e

echo "🔍 NCRelay Build Validation"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track if any checks fail
FAILED=0

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        FAILED=1
    fi
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check 1: Node modules installed
print_info "Checking node modules..."
if [ -d "node_modules" ]; then
    print_status 0 "Node modules installed"
else
    print_status 1 "Node modules not found - run 'npm install'"
fi

# Check 2: TypeScript compilation (main project)
print_info "Running TypeScript check on main project..."
if npx tsc --noEmit; then
    print_status 0 "TypeScript compilation successful"
else
    print_status 1 "TypeScript compilation failed"
fi

# Check 3: TypeScript compilation (migrations)
print_info "Running TypeScript check on migrations..."
if npx tsc --project tsconfig.migrations.json --noEmit; then
    print_status 0 "Migration TypeScript compilation successful"
else
    print_status 1 "Migration TypeScript compilation failed"
fi

# Check 4: TypeScript compilation (server)
print_info "Running TypeScript check on server..."
if npx tsc --project tsconfig.server.json --noEmit; then
    print_status 0 "Server TypeScript compilation successful"
else
    print_status 1 "Server TypeScript compilation failed"
fi

# Check 5: ESLint
print_info "Running ESLint..."
if npx next lint 2>&1 | grep -q "Invalid project directory"; then
    print_warning "ESLint check skipped (needs .next directory)"
elif npx next lint > /dev/null 2>&1; then
    print_status 0 "ESLint passed"
else
    print_warning "ESLint found issues (non-critical)"
fi

# Check 6: Check for common issues
print_info "Checking for common issues..."

# Check for missing imports in lucide-react
MISSING_LUCIDE=$(grep -r "from \"lucide-react\"" src/ 2>/dev/null | while read line; do
    file=$(echo "$line" | cut -d: -f1)
    imports=$(echo "$line" | sed -n 's/.*{\s*\([^}]*\)\s*}.*/\1/p')
    if [ ! -z "$imports" ]; then
        # Check if the file actually uses those imports
        IFS=',' read -ra ICONS <<< "$imports"
        for icon in "${ICONS[@]}"; do
            icon=$(echo "$icon" | xargs) # trim whitespace
            if ! grep -q "$icon" "$file" 2>/dev/null; then
                echo "$file: Unused import $icon"
            fi
        done
    fi
done)

if [ -z "$MISSING_LUCIDE" ]; then
    print_status 0 "No obvious import issues detected"
else
    print_warning "Potential unused imports found (review recommended)"
fi

# Check 7: Check for console.log statements (warning only)
print_info "Checking for console statements..."
CONSOLE_COUNT=$(grep -r "console\." src/ --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | wc -l)
if [ "$CONSOLE_COUNT" -gt 50 ]; then
    print_warning "Found $CONSOLE_COUNT console statements (consider using proper logging)"
else
    print_status 0 "Console statement count reasonable ($CONSOLE_COUNT)"
fi

# Check 8: Check for TODO/FIXME comments
print_info "Checking for TODO/FIXME comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME" src/ --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null | wc -l)
if [ "$TODO_COUNT" -gt 0 ]; then
    print_warning "Found $TODO_COUNT TODO/FIXME comments"
else
    print_status 0 "No TODO/FIXME comments found"
fi

# Summary
echo ""
echo "=========================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo -e "${GREEN}  Safe to commit and build Docker image${NC}"
    exit 0
else
    echo -e "${RED}✗ Some checks failed!${NC}"
    echo -e "${RED}  Fix errors before building Docker image${NC}"
    exit 1
fi
