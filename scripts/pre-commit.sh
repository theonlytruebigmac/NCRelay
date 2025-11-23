#!/bin/bash

# Pre-commit Hook for NCRelay
# This runs automatic validation before allowing commits
# Install: cp scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

echo "🔒 Running pre-commit validation..."
echo ""

# Run TypeScript check only (fast check)
if ! npx tsc --noEmit --pretty; then
    echo ""
    echo "❌ TypeScript errors found!"
    echo "   Fix errors before committing or use 'git commit --no-verify' to skip"
    exit 1
fi

echo ""
echo "✓ Pre-commit validation passed!"
exit 0
